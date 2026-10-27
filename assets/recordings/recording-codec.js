(function installRecordingCodec(root, factory) {
  const codec = factory();
  if (typeof module === "object" && module.exports) module.exports = codec;
  if (root) root.RECORDING_CODEC = codec;
}(typeof globalThis === "object" ? globalThis : this, () => {
  "use strict";

  const FORMAT_VERSION = 1;
  // New kinds are appended so archived four-kind recordings remain readable.
  const CATALOG_KINDS = ["cards", "talents", "fateStrategies", "characters", "xianMoStrategies"];
  const CATALOG_ITEM_KEYS = new Set([
    "id", "file", "targetUid", "targetUsername", "targetCharacterId",
    "startingRating", "career", "rounds", "capturedThrough", "linCareer",
    "linFates", "linUnchosenFates", "humanOpponentCharacters", "label",
    "placementStart", "placementEnd", "ratingChange", "ratingKind",
    "gameMode", "firstRound", "cupId", "cupProgress", "cupStage", "practice",
    "seasonMechanic", "seasonMechanicEnabled", "linXianMoFates", "linUnchosenXianMoFates",
    "roundOneXianMoPool", "xianMoPools",
  ]);

  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const byteLength = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

  function collectValueMetadata(value) {
    const shapeCounts = new Map();
    const shapeKeys = new Map();
    const stringCounts = new Map();
    const visit = (current) => {
      if (isObject(current)) {
        const keys = Object.keys(current);
        const signature = JSON.stringify(keys);
        shapeCounts.set(signature, (shapeCounts.get(signature) ?? 0) + 1);
        shapeKeys.set(signature, keys);
        for (const child of Object.values(current)) visit(child);
      } else if (Array.isArray(current)) {
        for (const child of current) visit(child);
      } else if (typeof current === "string") {
        stringCounts.set(current, (stringCounts.get(current) ?? 0) + 1);
      }
    };
    visit(value);
    const shapes = [...shapeCounts]
      .sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
      .map(([signature]) => shapeKeys.get(signature));
    const strings = [...stringCounts]
      .filter(([text, count]) => {
        if (count < 2) return false;
        const literalBytes = byteLength(text);
        return literalBytes * (count - 1) > 6 * count + 2;
      })
      .sort((first, second) => second[1] - first[1]
        || byteLength(second[0]) - byteLength(first[0])
        || first[0].localeCompare(second[0]))
      .map(([text]) => text);
    return { shapes, strings };
  }

  function packValue(value, options = {}) {
    const metadata = collectValueMetadata(value);
    const stringLimit = options.stringLimit === undefined
      ? metadata.strings.length : Math.max(0, Number(options.stringLimit) || 0);
    const strings = metadata.strings.slice(0, stringLimit);
    const shapeIndex = new Map(metadata.shapes.map((keys, index) => [JSON.stringify(keys), index]));
    const stringIndex = new Map(strings.map((text, index) => [text, index]));
    const encode = (current) => {
      if (isObject(current)) {
        const keys = Object.keys(current);
        return [0, shapeIndex.get(JSON.stringify(keys)), ...keys.map((key) => encode(current[key]))];
      }
      if (Array.isArray(current)) return [1, ...current.map(encode)];
      if (typeof current === "string" && stringIndex.has(current)) return [2, stringIndex.get(current)];
      return current;
    };
    return [metadata.shapes, strings, encode(value)];
  }

  function unpackValue(packed) {
    if (!Array.isArray(packed) || packed.length !== 3) throw new Error("invalid packed value");
    const [shapes, strings, encoded] = packed;
    const decode = (current) => {
      if (!Array.isArray(current)) return current;
      const tag = current[0];
      if (tag === 0) {
        const keys = shapes[current[1]];
        if (!keys) throw new Error(`unknown recording object schema ${current[1]}`);
        if (current.length !== keys.length + 2) throw new Error("recording object schema length mismatch");
        return Object.fromEntries(keys.map((key, index) => [key, decode(current[index + 2])]));
      }
      if (tag === 1) return current.slice(1).map(decode);
      if (tag === 2) {
        if (typeof strings[current[1]] !== "string") throw new Error(`unknown recording string ${current[1]}`);
        return strings[current[1]];
      }
      throw new Error(`unknown packed recording tag ${tag}`);
    };
    return decode(encoded);
  }

  function packSharedCatalog(catalog) {
    return CATALOG_KINDS.map((kind) => {
      const entries = catalog[kind] ?? {};
      const groups = new Map();
      for (const [mapKey, entry] of Object.entries(entries)) {
        const keys = Object.keys(entry);
        const signature = JSON.stringify(keys);
        if (!groups.has(signature)) groups.set(signature, { keys, rows: [] });
        groups.get(signature).rows.push([mapKey, ...keys.map((key) => entry[key])]);
      }
      return [...groups.values()].map(({ keys, rows }) => [keys, rows]);
    });
  }

  function unpackSharedCatalog(packed) {
    if (!Array.isArray(packed) || ![4, CATALOG_KINDS.length].includes(packed.length)) {
      throw new Error("invalid shared recording catalog");
    }
    return Object.fromEntries(CATALOG_KINDS.map((kind, kindIndex) => {
      const entries = {};
      for (const [keys, rows] of packed[kindIndex] ?? []) {
        for (const row of rows) {
          if (row.length !== keys.length + 1) throw new Error(`invalid ${kind} catalog row`);
          entries[row[0]] = Object.fromEntries(keys.map((key, index) => [key, row[index + 1]]));
        }
      }
      return [kind, entries];
    }));
  }

  function catalogReferences(catalog) {
    return CATALOG_KINDS.map((kind) => Object.keys(catalog[kind] ?? {}));
  }

  function catalogFromReferences(references, sharedCatalog) {
    if (!Array.isArray(references) || ![4, CATALOG_KINDS.length].includes(references.length)) {
      throw new Error("invalid recording catalog references");
    }
    return Object.fromEntries(CATALOG_KINDS.map((kind, kindIndex) => {
      const sharedEntries = sharedCatalog[kind] ?? {};
      const entries = {};
      for (const id of references[kindIndex] ?? []) {
        if (!(id in sharedEntries)) throw new Error(`recording references missing ${kind} ${id}`);
        entries[id] = sharedEntries[id];
      }
      return [kind, entries];
    }));
  }

  function packRecording(recording, options = {}) {
    const { catalog, ...withoutCatalog } = recording;
    const packed = [FORMAT_VERSION, catalogReferences(catalog), packValue(withoutCatalog, options)];
    if (options.sharedCatalog) {
      const overrides = {};
      for (const kind of CATALOG_KINDS) {
        for (const [id, entry] of Object.entries(catalog[kind] ?? {})) {
          if (JSON.stringify(entry) !== JSON.stringify(options.sharedCatalog[kind]?.[id])) {
            (overrides[kind] ??= {})[id] = entry;
          }
        }
      }
      if (Object.keys(overrides).length) packed.push(packValue(overrides));
    }
    return packed;
  }

  function unpackRecording(packed, sharedCatalog) {
    if (!Array.isArray(packed) || packed[0] !== FORMAT_VERSION || ![3, 4].includes(packed.length)) {
      throw new Error("unsupported packed recording format");
    }
    const recording = unpackValue(packed[2]);
    const overrides = packed.length === 4 ? unpackValue(packed[3]) : {};
    const effectiveCatalog = Object.fromEntries(CATALOG_KINDS.map(kind =>
      [kind, { ...sharedCatalog[kind], ...overrides[kind] }]));
    const catalog = catalogFromReferences(packed[1], effectiveCatalog);
    return {
      id: recording.id,
      targetUid: recording.targetUid,
      targetUsername: recording.targetUsername,
      catalog,
      steps: recording.steps,
    };
  }

  function compactFate(id, sharedCatalog) {
    const info = sharedCatalog.fateStrategies[id];
    if (!info) throw new Error(`catalog references missing fate strategy ${id}`);
    return { id: Number(id), nameEnglish: info.nameEnglish, nameChinese: info.nameChinese };
  }

  function compactXianMoFate(id, sharedCatalog) {
    const info = sharedCatalog.xianMoStrategies[id];
    if (!info) throw new Error(`catalog references missing xianmo strategy ${id}`);
    return { id: Number(id), nameEnglish: info.nameEnglish, nameChinese: info.nameChinese };
  }

  function compactCharacter(id, sharedCatalog) {
    const info = sharedCatalog.characters[id];
    if (!info) throw new Error(`catalog references missing character ${id}`);
    return { id: Number(id), nameChinese: info.nameChinese, nameEnglish: info.nameEnglish };
  }

  function packCatalog(sharedCatalog, items) {
    const groups = new Map();
    for (const item of items) {
      for (const key of Object.keys(item)) {
        if (!CATALOG_ITEM_KEYS.has(key)) throw new Error(`unencoded recording catalog field ${key}`);
      }
      const groupKey = JSON.stringify([item.targetUid, item.targetUsername, item.targetCharacterId]);
      if (!groups.has(groupKey)) groups.set(groupKey, [item.targetUid, item.targetUsername, item.targetCharacterId, []]);
      const filterLabels = {};
      for (const [field, kind] of [["linFates", "fateStrategies"], ["linUnchosenFates", "fateStrategies"],
        ["linXianMoFates", "xianMoStrategies"], ["linUnchosenXianMoFates", "xianMoStrategies"],
        ["humanOpponentCharacters", "characters"]]) {
        const entries = item[field] ?? [];
        if (entries.some(entry => entry.nameEnglish !== sharedCatalog[kind]?.[entry.id]?.nameEnglish
          || entry.nameChinese !== sharedCatalog[kind]?.[entry.id]?.nameChinese
          || Object.keys(entry).some(key => !["id", "nameEnglish", "nameChinese"].includes(key)))) filterLabels[field] = entries;
      }
      groups.get(groupKey)[3].push([
        item.id,
        item.startingRating,
        item.career,
        item.rounds,
        item.capturedThrough,
        item.linCareer,
        (item.linFates ?? []).map(({ id }) => id),
        (item.linUnchosenFates ?? []).map(({ id }) => id),
        (item.humanOpponentCharacters ?? []).map(({ id }) => id),
        item.gameMode ?? 0,
        item.firstRound ?? 1,
        item.cupId ?? 0,
        item.cupProgress ?? 0,
        item.cupStage ?? "",
        item.practice ? 1 : 0,
        item.placementStart ?? null,
        item.placementEnd ?? null,
        item.ratingChange ?? null,
        item.ratingKind ?? "",
        item.seasonMechanic ?? null,
        (item.linXianMoFates ?? []).map(({ id }) => id),
        (item.linUnchosenXianMoFates ?? []).map(({ id }) => id),
        Object.keys(filterLabels).length ? filterLabels : null,
        item.seasonMechanicEnabled ?? null,
        item.roundOneXianMoPool ?? null,
        item.xianMoPools ?? null,
      ]);
    }
    return [FORMAT_VERSION, packSharedCatalog(sharedCatalog), [...groups.values()]];
  }

  // Browser indexes are derived, lossy list projections; canonical catalogs and
  // recorded timelines retain FORMAT_VERSION 1 and their complete metadata.
  const BROWSER_INDEX_VERSION = 2;
  const BROWSER_POOL_EXAMPLE_FATES = {
    1: 1001, 2: 2001, 3: 3001, 4: 4001, 5: 5001, 6: 6001, 7: 7001,
    8: 8001, 9: 9001, 10: 10001, 12: 12001, 13: 13001, 14: 14001,
    15: 15001, 16: 16001, 17: 17034, 18: 18001, 19: 19001, 20: 20001,
    21: 21001, 22: 22001, 23: 23001,
  };

  function browserPool(pool) {
    const { offeredFateIds, ...descriptor } = pool;
    return { ...descriptor, sortFateId: Number(offeredFateIds?.[0] ?? 0) };
  }

  function packBrowserCatalog(sharedCatalog, items) {
    const dictionaries = { fates: [], xianMoFates: [], characters: [], pools: [], examples: {} };
    const indexes = Object.fromEntries(["fates", "xianMoFates", "characters", "pools"]
      .map(kind => [kind, new Map()]));
    const reference = (kind, entry) => {
      const signature = JSON.stringify(entry), index = indexes[kind];
      if (!index.has(signature)) {
        index.set(signature, dictionaries[kind].length);
        dictionaries[kind].push(entry);
      }
      return index.get(signature);
    };
    const references = (kind, entries) => (entries ?? []).map(entry => reference(kind, entry));
    const groups = new Map();
    for (const item of items) {
      for (const key of Object.keys(item)) {
        if (!CATALOG_ITEM_KEYS.has(key)) throw new Error(`unencoded browser catalog field ${key}`);
      }
      const groupKey = JSON.stringify([item.targetUid, item.targetUsername, item.targetCharacterId]);
      if (!groups.has(groupKey)) groups.set(groupKey, [item.targetUid, item.targetUsername, item.targetCharacterId, []]);
      const pool = item.roundOneXianMoPool;
      if (pool) {
        const id = BROWSER_POOL_EXAMPLE_FATES[pool.poolId], info = sharedCatalog.xianMoStrategies?.[id];
        if (info) dictionaries.examples[id] = { id: info.id, nameEnglish: info.nameEnglish, nameChinese: info.nameChinese };
      }
      groups.get(groupKey)[3].push([
        item.id, item.startingRating, item.career, item.rounds, item.capturedThrough, item.linCareer,
        references("fates", item.linFates), references("xianMoFates", item.linXianMoFates),
        references("characters", item.humanOpponentCharacters),
        item.gameMode ?? 0, item.firstRound ?? 1, item.cupId ?? 0, item.cupProgress ?? 0,
        item.cupStage ?? "", item.practice ? 1 : 0,
        item.placementStart ?? null, item.placementEnd ?? null, item.ratingChange ?? null,
        item.ratingKind ?? "", item.seasonMechanic ?? null, item.seasonMechanicEnabled ?? null,
        pool == null ? null : reference("pools", browserPool(pool)),
        item.xianMoPools == null ? null : references("pools", item.xianMoPools.map(browserPool)),
      ]);
    }
    return [BROWSER_INDEX_VERSION, packValue(dictionaries), [...groups.values()]];
  }

  function unpackBrowserCatalog(packed) {
    if (!Array.isArray(packed) || packed[0] !== BROWSER_INDEX_VERSION || packed.length !== 3) {
      throw new Error("unsupported browser recording catalog format");
    }
    const dictionaries = unpackValue(packed[1]);
    for (const kind of ["fates", "xianMoFates", "characters", "pools"]) {
      if (!Array.isArray(dictionaries[kind])) throw new Error(`invalid browser ${kind} dictionary`);
    }
    if (!isObject(dictionaries.examples)) throw new Error("invalid browser example metadata");
    const entry = (kind, index) => {
      if (!Number.isSafeInteger(index) || index < 0 || index >= dictionaries[kind].length) {
        throw new Error(`invalid browser ${kind} reference ${index}`);
      }
      return dictionaries[kind][index];
    };
    const entries = (kind, indexes) => {
      if (!Array.isArray(indexes)) throw new Error(`invalid browser ${kind} references`);
      return indexes.map(index => entry(kind, index));
    };
    const catalog = [];
    for (const [targetUid, targetUsername, targetCharacterId, games] of packed[2]) {
      for (const game of games) {
        if (game.length !== 23) throw new Error("invalid browser catalog row length");
        const [id, startingRating, career, rounds, capturedThrough, linCareer,
          fateRefs, xianMoRefs, opponentRefs, gameMode, firstRound, cupId, cupProgress, cupStage,
          practice, placementStart, placementEnd, ratingChange, ratingKind, seasonMechanic,
          seasonMechanicEnabled, roundOnePoolRef, poolRefs] = game;
        if (seasonMechanicEnabled !== null && typeof seasonMechanicEnabled !== "boolean") {
          throw new Error("invalid catalog mechanic activation flag");
        }
        catalog.push({ id, file: `${id}.compact.json.gz`, targetUid, targetUsername, targetCharacterId,
          startingRating, career, rounds, capturedThrough, linCareer,
          linFates: entries("fates", fateRefs), linXianMoFates: entries("xianMoFates", xianMoRefs),
          humanOpponentCharacters: entries("characters", opponentRefs),
          gameMode, firstRound, cupId, cupProgress, cupStage, practice: Boolean(practice),
          placementStart, placementEnd, ratingChange, ratingKind, seasonMechanic, seasonMechanicEnabled,
          ...(roundOnePoolRef == null ? {} : { roundOneXianMoPool: entry("pools", roundOnePoolRef) }),
          ...(poolRefs == null ? {} : { xianMoPools: entries("pools", poolRefs) }),
          label: `${targetUsername} · ${rounds} rounds`,
        });
      }
    }
    return {
      sharedCatalog: Object.fromEntries(CATALOG_KINDS.map(kind => [kind, kind === "xianMoStrategies" ? dictionaries.examples : {}])),
      catalog,
    };
  }

  function unpackCatalog(packed) {
    if (packed?.[0] === BROWSER_INDEX_VERSION) return unpackBrowserCatalog(packed);
    if (!Array.isArray(packed) || packed[0] !== FORMAT_VERSION || packed.length !== 3) {
      throw new Error("unsupported packed recording catalog format");
    }
    const sharedCatalog = unpackSharedCatalog(packed[1]);
    const catalog = [];
    for (const [targetUid, targetUsername, targetCharacterId, games] of packed[2]) {
      for (const game of games) {
        const [id, startingRating, career, rounds, capturedThrough, linCareer,
          fateIds, unchosenFateIds, opponentIds, gameMode = 0, firstRound = 1,
          cupId = 0, cupProgress = 0, cupStage = "", practice = 0, placementStart = null, placementEnd = null,
          ratingChange = null, ratingKind = "", seasonMechanic = null,
          xianMoFateIds = [], unchosenXianMoFateIds = [], filterLabels = null,
          seasonMechanicEnabled = null, roundOneXianMoPool = null, xianMoPools = null] = game;
        if (seasonMechanicEnabled !== null && typeof seasonMechanicEnabled !== "boolean") {
          throw new Error("invalid catalog mechanic activation flag");
        }
        const namedEntries = (ids, lookup, field) => {
          const entries = ids.map(value => lookup(value, sharedCatalog));
          const labels = filterLabels?.[field];
          if (labels == null) return entries;
          if (!Array.isArray(labels) || labels.length !== ids.length
            || labels.some((entry, index) => entry?.id !== ids[index])) throw new Error(`invalid catalog filter labels: ${field}`);
          return labels;
        };
        catalog.push({
          id,
          file: `${id}.compact.json.gz`,
          targetUid,
          targetUsername,
          targetCharacterId,
          startingRating,
          career,
          rounds,
          capturedThrough,
          linCareer,
          linFates: namedEntries(fateIds, compactFate, "linFates"),
          linUnchosenFates: namedEntries(unchosenFateIds, compactFate, "linUnchosenFates"),
          linXianMoFates: namedEntries(xianMoFateIds, compactXianMoFate, "linXianMoFates"),
          linUnchosenXianMoFates: namedEntries(unchosenXianMoFateIds, compactXianMoFate, "linUnchosenXianMoFates"),
          humanOpponentCharacters: namedEntries(opponentIds, compactCharacter, "humanOpponentCharacters"),
          gameMode,
          firstRound,
          cupId,
          cupProgress,
          cupStage,
          practice: Boolean(practice),
          placementStart, placementEnd, ratingChange, ratingKind,
          seasonMechanic,
          seasonMechanicEnabled,
          ...(roundOneXianMoPool == null ? {} : { roundOneXianMoPool }),
          ...(xianMoPools == null ? {} : { xianMoPools }),
          label: `${targetUsername} · ${rounds} rounds`,
        });
      }
    }
    return { sharedCatalog, catalog };
  }

  return {
    FORMAT_VERSION,
    BROWSER_INDEX_VERSION,
    CATALOG_KINDS,
    packValue,
    unpackValue,
    packSharedCatalog,
    unpackSharedCatalog,
    packRecording,
    unpackRecording,
    packCatalog,
    unpackCatalog,
    packBrowserCatalog,
    unpackBrowserCatalog,
  };
}));
