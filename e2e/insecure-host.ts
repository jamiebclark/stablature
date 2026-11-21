/** Spec 012: the plain-http host the `insecure` project reaches the app by, and the Chromium rule that maps it to this machine. */
export const INSECURE_HOST = "lan.test";
export const INSECURE_HOST_RULE = `--host-resolver-rules=MAP ${INSECURE_HOST} 127.0.0.1`;
