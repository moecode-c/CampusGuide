export type MidtermInput = {
  subject: string;
  midtermMark: number;
  creditHours: number;
};

export type GradeResult = {
  subject: string;
  midtermMark: number;
  creditHours: number;
  letter: string;
  gpa: number;
};

export type GpaSummary = {
  items: GradeResult[];
  overallGpa: number;
};

export type GpaPlugin = {
  id: string;
  name: string;
  compute: (inputs: MidtermInput[]) => GpaSummary;
};
