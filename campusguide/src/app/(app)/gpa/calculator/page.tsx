import { GpaCalculatorClient } from "@/components/gpa/GpaCalculatorClient";

export default function GpaCalculatorPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">GPA Calculator</h1>
      <p className="text-sm text-foreground/70">Enter letter grades (A, B+, …) or marks (0–100) to calculate GPA.</p>
      <div className="pt-4">
        <GpaCalculatorClient />
      </div>
    </div>
  );
}
