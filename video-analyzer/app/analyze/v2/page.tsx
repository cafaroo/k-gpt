"use client";
import { Dropzone } from "@/components/video/v2/dropzone";
import { QueueList } from "@/components/video/v2/queue-list";
import { useV2UploadQueue } from "@/hooks/use-v2-upload-queue";

export default function UploadPage() {
  const { items, enqueue } = useV2UploadQueue();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New analysis</h1>
        <p className="text-sm text-muted-foreground">
          Drop one or many videos. Each is analyzed with the 2026.04-v2 schema
          (ECR, NAWP, colloquiality, authenticity, emotional flow).
        </p>
      </div>
      <Dropzone onFiles={enqueue} />
      <QueueList items={items} />
    </div>
  );
}
