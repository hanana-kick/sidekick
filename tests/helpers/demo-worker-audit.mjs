/** Serialized by Playwright into each document, including every replacement iframe. */
export function installDemoWorkerAudit() {
  const isParent = window === top;
  if (isParent) top.demoWorkerAudit = { header: { created: 0, terminated: 0 }, demos: [] };
  let documentAudit;
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args);
      // Capture this document's record once, not whichever iframe is current at termination.
      if (!documentAudit) {
        documentAudit = isParent ? top.demoWorkerAudit.header : { url: location.href, created: 0, terminated: 0 };
        if (!isParent) top.demoWorkerAudit.demos.push(documentAudit);
      }
      documentAudit.created++;
      this.auditTerminated = false;
    }
    terminate() {
      if (!this.auditTerminated) { documentAudit.terminated++; this.auditTerminated = true; }
      return super.terminate();
    }
  };
}
