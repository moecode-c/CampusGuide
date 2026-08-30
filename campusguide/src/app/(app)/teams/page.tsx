import { TeamsClient } from "./TeamsClient";

export const metadata = {
  title: "Project Teams | CampusGuide",
  description: "Find a project team, or post the spots your team still needs to fill.",
};

export default function TeamsPage() {
  return <TeamsClient />;
}
