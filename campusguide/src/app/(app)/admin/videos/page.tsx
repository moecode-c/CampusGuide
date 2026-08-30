import { VideoCourseManager } from "@/components/admin/VideoCourseManager";

export default function AdminVideosPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Videos</h1>
      <p className="text-sm text-foreground/70">
        Group YouTube videos into courses students can work through in order.
      </p>

      <div className="mt-4">
        <VideoCourseManager />
      </div>
    </div>
  );
}
