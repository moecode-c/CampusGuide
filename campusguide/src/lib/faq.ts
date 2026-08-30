import {
  Award,
  CalendarCheck2,
  KeyRound,
  Languages,
  MapPin,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

/**
 * FAQ content and its topic catalog.
 *
 * Everything a non-developer needs to edit lives in this file: add a topic to
 * FAQ_TOPICS, add questions to FAQS with a matching `topic`, and the page
 * regroups itself. Counts, empty states and search all derive from these two
 * arrays.
 */

export type FaqTopicId =
  | "grades"
  | "english"
  | "standing"
  | "attendance"
  | "campus"
  | "accounts";

export type FaqTopic = {
  id: FaqTopicId;
  label: string;
  /** One line under the label on the topic card. */
  blurb: string;
  /** Placeholder art. Expressive on purpose — see `image` below to replace it. */
  icon: LucideIcon;
  /**
   * REPLACING THE ICONS WITH YOUR OWN ARTWORK:
   * drop a file into /public (e.g. /public/faq/grades.png) and set
   *   image: "/faq/grades.png"
   * on that topic. The card renders the image instead of the icon — no other
   * change needed, and topics without an image keep using theirs.
   */
  image?: string;
};

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: "grades",
    label: "Grades & passing",
    blurb: "What you need to pass a course and each exam",
    icon: Award,
  },
  {
    id: "english",
    label: "English levels",
    blurb: "The four levels, and which ones count toward your GPA",
    icon: Languages,
  },
  {
    id: "standing",
    label: "Blocks & probation",
    blurb: "Advising, accounting, drafting and what probation means",
    icon: ShieldAlert,
  },
  {
    id: "attendance",
    label: "Attendance",
    blurb: "The 25% rule and how you get dropped",
    icon: CalendarCheck2,
  },
  {
    id: "campus",
    label: "Finding rooms",
    blurb: "How room codes work and how to get to yours",
    icon: MapPin,
  },
  {
    id: "accounts",
    label: "Portal & Teams",
    blurb: "Passwords and online meetings",
    icon: KeyRound,
  },
];

export type Faq = { topic: FaqTopicId; question: string; answer: string };

export const FAQS: Faq[] = [
  // ------------------------------------------------------------- grades
  {
    topic: "grades",
    question: "What is the passing grade in each course?",
    answer:
      "Every course is out of 100%, and you need 60% or more to pass it. Anything below 60% is a fail.",
  },
  {
    topic: "grades",
    question: "I passed the course overall but failed one exam — do I still pass?",
    answer:
      "No. There is a separate 30% minimum on each individual exam. Even if your total in the course is 60% or higher, scoring less than 30% in the midterm or in the final means you fail the whole course. Both conditions have to be met: 60% overall, and at least 30% in each exam.",
  },

  // ------------------------------------------------------------ english
  {
    topic: "english",
    question: "What are the English levels?",
    answer:
      "There are four, taken in order:\n\nLevel 1 — FAE1 (Fundamentals of Academic English)\nLevel 2 — FAE2 (Fundamentals of Academic English 2)\nLevel 3 — EAP (English for Academic Purposes)\nLevel 4 — Freshman 1\n\nWhich one you start at depends on your placement, so not everyone begins at level 1.",
  },
  {
    topic: "english",
    question: "Do the English levels count toward my GPA?",
    answer:
      "Only the last two.\n\nFAE1 and FAE2 (levels 1 and 2) do not count toward your GPA.\n\nEAP and Freshman 1 (levels 3 and 4) do count toward your GPA, like any other course.",
  },
  {
    topic: "english",
    question: "Which English courses should I put in the GPA calculator?",
    answer:
      "Add EAP and Freshman 1 only. Leaving FAE1 or FAE2 in will give you a GPA that does not match your transcript, because the university does not count them.",
  },

  // ----------------------------------------------------------- standing
  {
    topic: "standing",
    question: "What does “blocked by advising” mean?",
    answer:
      "It means your GPA has dropped below 2.0. You are blocked by advising and placed on probation until you bring it back up.",
  },
  {
    topic: "standing",
    question: "What is probation?",
    answer:
      "While you are on probation you take 4 courses per semester, and you get 3 chances to get out of it. If you have not brought your GPA back above 2.0 after those 3 chances, you are expelled.\n\nThe 3 chances are counted in the semesters themselves — summer does not count as one of them.",
  },
  {
    topic: "standing",
    question: "Why am I blocked by accounting?",
    answer: "You have unpaid university bills. Settle them with accounting and the block is lifted.",
  },
  {
    topic: "standing",
    question: "Why am I blocked by drafting?",
    answer:
      "Your military papers are missing. Submit the required drafting paperwork and the block is lifted.",
  },

  // --------------------------------------------------------- attendance
  {
    topic: "attendance",
    question: "How does attendance work, and when do I get dropped?",
    answer:
      "You are allowed to miss up to 25% of the sessions in each course. The moment you go past that, your name goes onto the attendance sheet posted before the final — that sheet is what tells you that you have been given a drop in that course.\n\nThe Attendance page here works the 25% out per course so you can see how many absences you have left, but it is only a calculator over the numbers you enter. It is not connected to the university's records, so always confirm your real standing with your professor.",
  },

  {
    topic: "attendance",
    question: "I am sick and cannot attend — who do I send my medical report to?",
    answer:
      "Email the report to students.medical@miuegypt.edu.eg, and bring the physical medical report with you when you come to university. The doctors review it and approve it if it is a valid report.\n\nImportant: an approved medical report does not remove the absence. It adds an extra 5% to your allowed absences — so it raises your limit, it does not undo the sessions you already missed.",
  },

  // ------------------------------------------------------------- campus
  {
    topic: "campus",
    question: "How do room codes work, and how do I find my room?",
    answer:
      "The code tells you the building and the floor.\n\n• Main building rooms are just numbers, and the first digit is the floor — 227 is on the 2nd floor, 327 is on the 3rd.\n\n• N, S, R and K rooms start with their building letter. Where there is a second letter, it is the floor: A is floor 1, B is floor 2, C is floor 3, D is floor 4, E is floor 5. So RB4 is R building, 2nd floor, and NC2 is N building, 3rd floor.\n\n• Plain numbered rooms in a lettered building (N15, S24) follow their own ranges per floor.\n\nThe fastest way is the Map page: search the room code and it highlights the room for you. Any class in your Calendar also links straight to its location.",
  },

  // ----------------------------------------------------------- accounts
  {
    topic: "accounts",
    question: "How do I get my password for online meetings on Microsoft Teams?",
    answer:
      "Go to the student portal, open the Microsoft Teams section, and set your password there. That is the password you then use to sign in to Teams for your online lectures.",
  },
];

export function topicById(id: FaqTopicId) {
  return FAQ_TOPICS.find((t) => t.id === id);
}

export function questionsFor(id: FaqTopicId) {
  return FAQS.filter((f) => f.topic === id);
}

/** Case-insensitive match across the question, the answer and the topic label. */
export function searchFaqs(raw: string) {
  const query = raw.trim().toLowerCase();
  if (!query) return [];

  return FAQS.filter((f) => {
    const label = topicById(f.topic)?.label ?? "";
    return `${f.question} ${f.answer} ${label}`.toLowerCase().includes(query);
  });
}
