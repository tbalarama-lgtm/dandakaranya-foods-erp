import { HrPageHeader } from "@/components/hr/hr-page-header";
import { RecruitmentKanban } from "@/components/hr/recruitment-kanban";
import { MOCK_CANDIDATES, MOCK_JOBS } from "@/lib/hr/mock-data";
import { attachResumeMetadata } from "@/lib/hr/recruitment-resumes";

export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const candidates = await attachResumeMetadata(MOCK_CANDIDATES);

  return (
    <>
      <HrPageHeader
        title="Recruitment"
        description="Job openings, candidate pipeline, resume uploads, and interview scheduling."
      />
      <RecruitmentKanban jobs={MOCK_JOBS} initialCandidates={candidates} />
    </>
  );
}
