/**
 * AMD SEV Attestation
 * - Generates attestation report binding public key to TEE
 * - Frontend verifies this to prevent MITM/pubkey substitution
 */

const crypto = require('crypto');
const { execSync } = require('child_process');

/**
 * Check if SEV is active in this VM
 */
function isSevActive() {
  try {
    // Pattern: "AMD Memory Encryption Features active: SEV"
    const dmesg = execSync('dmesg 2>/dev/null | grep -i "encryption.*active\\|active.*sev" || true', {
      encoding: 'utf8',
      timeout: 5000
    });
    return dmesg.toLowerCase().includes('sev') || dmesg.toLowerCase().includes('encryption');
  } catch {
    return false;
  }
}

/**
 * Generate attestation report
 * Binds public key to TEE identity
 *
 * @param {string} publicKey - PEM encoded public key
 * @param {string} keyId - Unique key identifier
 * @returns {object} Attestation report
 */
async function generateAttestationReport(publicKey, keyId) {
  // Data to attest: pubkey hash + key_id + timestamp
  const attestData = {
    pubkey_hash: crypto.createHash('sha256').update(publicKey).digest('hex'),
    key_id: keyId,
    timestamp: Date.now(),
    vm_id: getVmId()
  };

  const dataString = JSON.stringify(attestData);
  const sevActive = isSevActive();

  // For now, using a simple hash-based attestation
  // In production, this should use actual SEV-SNP attestation via /dev/sev-guest
  // AMD provides sev-tool for generating real attestation reports

  const report = {
    type: sevActive ? 'amd-sev' : 'development',
    version: '1.0',
    data: attestData,
    signature: crypto.createHash('sha256')
      .update(dataString)
      .digest('hex'),
    sev_active: sevActive,
    generated_at: new Date().toISOString()
  };

  // If SEV-SNP is available, we would do:
  // const snpReport = await getSevSnpGuestReport(dataString);
  // report.snp_report = snpReport;

  return report;
}

/**
 * Get a unique VM identifier
 */
function getVmId() {
  try {
    // Try to get machine-id
    const machineId = execSync('cat /etc/machine-id 2>/dev/null || echo "unknown"', {
      encoding: 'utf8',
      timeout: 1000
    }).trim();
    return machineId.substring(0, 16);
  } catch {
    return 'unknown';
  }
}

/**
 * Verify attestation report (for testing)
 * In production, frontend should verify against AMD root certificate
 */
function verifyAttestationReport(report, expectedPubkeyHash) {
  if (!report || !report.data) return false;

  // Check pubkey hash matches
  if (report.data.pubkey_hash !== expectedPubkeyHash) {
    return false;
  }

  // Check timestamp is recent (within 1 hour)
  const age = Date.now() - report.data.timestamp;
  if (age > 60 * 60 * 1000) {
    return false;
  }

  // Verify signature
  const dataString = JSON.stringify(report.data);
  const expectedSig = crypto.createHash('sha256')
    .update(dataString)
    .digest('hex');

  return report.signature === expectedSig;
}

module.exports = {
  generateAttestationReport,
  isSevActive,
  verifyAttestationReport
};
