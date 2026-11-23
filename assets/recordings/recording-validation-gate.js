(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RECORDING_VALIDATION_GATE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const recordId = value => typeof value === 'string' && /^r-[a-f0-9]{16}$/.test(value);
  function failure(code, message, entry) {
    const error = new Error(message); error.code = code;
    if (entry) error.validationEntry = entry;
    return error;
  }
  function validateManifest(value) {
    if (!value || value.version !== 1 || !digest(value.validationResultsSha256)
      || !digest(value.sourceManifestSha256) || !value.records || typeof value.records !== 'object'
      || Array.isArray(value.records)) throw failure('VALIDATION_MANIFEST_INVALID', 'Invalid replay validation manifest');
    for (const [id, entry] of Object.entries(value.records)) {
      if (!recordId(id) || !entry || !['reconstructed-checked', 'current-reconstruction-rejected', 'legacy-unchecked'].includes(entry.status)) {
        throw failure('VALIDATION_MANIFEST_INVALID', 'Invalid replay validation status');
      }
      if (entry.status === 'reconstructed-checked' && (!digest(entry.payloadJsonSha256) || !digest(entry.validationKey))) {
        throw failure('VALIDATION_MANIFEST_INVALID', 'Checked replay lacks bound payload evidence');
      }
      if (entry.status === 'current-reconstruction-rejected' && (!Array.isArray(entry.reasonCodes)
        || !entry.reasonCodes.length || entry.reasonCodes.some(x => typeof x !== 'string' || !/^[a-z0-9-]{1,80}$/.test(x)))) {
        throw failure('VALIDATION_MANIFEST_INVALID', 'Rejected replay lacks safe reason codes');
      }
    }
    return value;
  }
  function createGate({manifestUrl = '', manifestSha256 = '', fetchBytes, sha256}) {
    if (!manifestUrl && !manifestSha256) {
      return {authorize: async () => ({status: 'legacy-unchecked'}), verifyPayload: async () => {}};
    }
    let pending;
    async function manifest() {
      if (!manifestUrl || !digest(manifestSha256)) throw failure('VALIDATION_MANIFEST_INVALID', 'Replay validation binding is incomplete');
      if (!pending) pending = (async () => {
        const bytes = await fetchBytes(manifestUrl);
        if (await sha256(bytes) !== manifestSha256) throw failure('VALIDATION_MANIFEST_HASH_MISMATCH', 'Replay validation manifest changed');
        return validateManifest(JSON.parse(new TextDecoder().decode(bytes)));
      })();
      return pending;
    }
    return {
      async authorize(id) {
        if (!recordId(id)) throw failure('VALIDATION_MANIFEST_INVALID', 'Invalid replay identity');
        const data = await manifest();
        const entry = Object.hasOwn(data.records, id) ? data.records[id] : {status: 'legacy-unchecked'};
        if (entry.status === 'current-reconstruction-rejected') {
          throw failure('REPLAY_RECONSTRUCTION_REJECTED', 'The current reconstruction could not verify this replay', entry);
        }
        return entry;
      },
      async verifyPayload(text, entry) {
        if (entry?.status !== 'reconstructed-checked') return;
        if (await sha256(new TextEncoder().encode(text)) !== entry.payloadJsonSha256) {
          throw failure('REPLAY_PAYLOAD_HASH_MISMATCH', 'Replay payload does not match its checked version');
        }
      },
    };
  }
  return {validateManifest, createGate};
});
