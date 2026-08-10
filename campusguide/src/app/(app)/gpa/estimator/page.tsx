import { MidtermClient } from "@/components/gpa/MidtermClient";

export default function GpaEstimatorPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">GPA Estimator</h1>
      <p className="text-sm text-foreground/70">
        Enter midterm exam marks out of 40 only (no finals, no coursework). We display a weighted GPA range: worst-case–best-case.
      </p>
      <div className="pt-4">
        <MidtermClient />
      </div>
    </div>
  );
}
