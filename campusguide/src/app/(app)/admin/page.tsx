import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, Library, Shield } from "lucide-react";

export default function AdminHomePage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Admin</h1>
      <p className="text-sm text-foreground/70">Manage global data: resources and rooms.</p>

      <div className="grid gap-6 pt-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Library className="h-5 w-5 text-primary" />
              Resources
            </CardTitle>
            <CardDescription>Upload files to R2 or add video links.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/resources">
              <Button variant="secondary">Manage</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Rooms map data
            </CardTitle>
            <CardDescription>RoomCode + image coordinates (x/y).</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/rooms">
              <Button variant="secondary">Manage</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="pt-2 text-xs text-foreground/70">
        <Shield className="inline h-4 w-4" /> Admin cannot edit student personal schedules or grades.
      </div>
    </div>
  );
}
