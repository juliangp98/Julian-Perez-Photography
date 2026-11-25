"use client";

// A button that uploads one file to a project. It opens the file picker, sends
// the file straight to Vercel Blob with a session-gated token
// (/api/portal/upload), and hands the stored file to `onUploaded`, which links
// it to the project. The caller shows the outcome with its own FormStatus.

import { useRef, useState, type ReactNode } from "react";
import Button, { type ButtonSize, type ButtonVariant } from "./Button";
import { UPLOAD_CONTENT_TYPES, UPLOAD_PATH } from "@/lib/labels";

export default function UploadButton({
  children,
  variant = "secondary",
  size = "md",
  disabled,
  onStart,
  onUploaded,
  onError,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onStart?: () => void;
  // Links the stored file to its project. A throw counts as a failed upload.
  onUploaded: (file: { url: string; name: string }) => Promise<void>;
  onError: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    onStart?.();
    try {
      // Dynamic import keeps the Blob client out of the initial bundle.
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`${UPLOAD_PATH}${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/portal/upload",
      });
      await onUploaded({ url: blob.url, name: file.name });
    } catch {
      onError();
    } finally {
      setUploading(false);
      // Cleared either way, so the same file can be picked again.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        loading={uploading}
        loadingLabel="Uploading…"
      >
        {children}
      </Button>
      {/* The picker itself; the button above opens it. */}
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_CONTENT_TYPES.join(",")}
        onChange={onFile}
        className="hidden"
        tabIndex={-1}
        aria-hidden
      />
    </>
  );
}
