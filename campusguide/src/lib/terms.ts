/**
 * The rules every account agrees to at sign-up.
 *
 * Versioned on purpose: the accepted version is stored against the account, so
 * there is a record of *which* wording a given student agreed to. Change the
 * text and you must bump the version — otherwise the record claims they agreed
 * to something they never saw.
 */

export const TERMS_VERSION = "1.0";

/** Last time the wording below changed. Shown on the page. */
export const TERMS_UPDATED = "30 August 2026";

export type TermsSection = {
  id: string;
  title: string;
  /** The first paragraph is the binding statement; the rest is explanation. */
  body: string[];
};

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "responsibility",
    title: "Using this website is your own responsibility",
    body: [
      "Everything on CampusGuide — including and especially the attendance calculator, the GPA calculator and the GPA estimator — is a personal aid. Using it is entirely at your own risk and your own responsibility.",
      "The attendance calculator works only from numbers you type in and boxes you tick yourself. It is not connected to the university's attendance records and has no way to know your real standing, whether a session was cancelled, or whether an excuse was accepted.",
      "If you are dropped from a course, barred from an exam, or suffer any academic consequence because you relied on a figure shown here, that is your responsibility and not CampusGuide's. Always confirm your real attendance and grades with your professor or student affairs.",
    ],
  },
  {
    id: "miu-only",
    title: "MIU students only — sharing is strictly prohibited",
    body: [
      "This website is exclusively for students of Misr International University. You must not share it with anyone who is not an MIU student.",
      "You must not share your account, your password, or any content taken from this site — including lecture material, summaries, past exams and any other uploaded resource — with any person outside MIU, or publish it anywhere else.",
      "Your account is personal to you. Do not let anyone else sign in as you, and do not sign in as anyone else.",
    ],
  },
  {
    id: "conduct",
    title: "Suspicious activity and breaking these rules",
    body: [
      "Any suspicious activity, misuse of this website, or breach of these rules may result in legal action, and in action taken by the university against you.",
      "Activity on this site is logged. This includes sign-ins, failed sign-in attempts, downloads, and content you post or delete. Administrators review this record.",
      "Accounts may be suspended or removed at any time, without notice, where misuse is suspected. Where appropriate, the matter will be referred to the university.",
    ],
  },
  {
    id: "content",
    title: "Content you post",
    body: [
      "Anything you post — including team posts and the contact number attached to them — is visible to other verified students on this site. Do not post anything you are not willing for them to see.",
      "Do not post content that is unlawful, abusive, harassing, or that infringes anybody's rights.",
    ],
  },
  {
    id: "availability",
    title: "Availability",
    body: [
      "CampusGuide is provided as-is, with no guarantee of availability or accuracy. Parts of it may be taken offline at any time, without notice, for maintenance or any other reason.",
    ],
  },
];

/** The one-line consent shown next to the checkbox on the register form. */
export const TERMS_CONSENT_LABEL =
  "I confirm I am an MIU student, I will not share this website or my account with anyone outside MIU, and I understand that using CampusGuide — including the attendance calculator — is my own responsibility.";
