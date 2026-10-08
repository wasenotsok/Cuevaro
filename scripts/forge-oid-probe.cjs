// Isolated upstream investigation only. Pass a trusted forge checkout's lib/index.js.
// Ephemeral synthetic signing demonstrates malformed encoding acceptance, not forgery.
const forge = require(process.argv[2]);
const a = forge.asn1;
const oid = a.oidToDer("2.16.840.1.101.3.4.2.1").getBytes();
const paddedOid = oid + "\x80".repeat(32);
const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 65537 });
const md = forge.md.sha256.create();
md.update("synthetic independent parser regression");
const digest = md.digest().getBytes();
const algorithm = a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, [
  a.create(a.Class.UNIVERSAL, a.Type.OID, false, paddedOid),
  a.create(a.Class.UNIVERSAL, a.Type.NULL, false, ""),
]);
const info = a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, [
  algorithm,
  a.create(a.Class.UNIVERSAL, a.Type.OCTETSTRING, false, digest),
]);
const signature = forge.pki.rsa.encrypt(
  a.toDer(info).getBytes(),
  keys.privateKey,
  0x01,
);
console.log(
  JSON.stringify({
    oid: a.derToOid(paddedOid),
    extraOidBytes: 32,
    verified: keys.publicKey.verify(digest, signature),
  }),
);
