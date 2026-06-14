import { HrPageHeader } from "@/components/hr/hr-page-header";
import { BiometricIntegrationClient } from "@/components/hr/biometric-integration-client";

export default function BiometricAttendancePage() {
  return (
    <>
      <HrPageHeader
        title="Biometric integration"
        description="Connect Secureye S-AIF600 (face + finger), ZKTeco, eSSL, ADMS push, or webhook agents."
      />
      <BiometricIntegrationClient />
    </>
  );
}
