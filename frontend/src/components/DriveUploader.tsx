"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "./Toast";
import { cn, formatFileSize } from "@/lib/utils";

interface DriveUploaderProps {
    onUploadSuccess?: (file: any) => void;
    className?: string;
    docType?: string;
}

export function DriveUploader({ onUploadSuccess, className, docType = "other" }: DriveUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { showToast } = useToast();

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0];
        setIsUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("docType", docType);

        try {
            // Simulate progress
            const interval = setInterval(() => {
                setUploadProgress((prev) => {
                    if (prev >= 90) {
                        clearInterval(interval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 500);

            const response = await fetch("/api/auth/upload", {
                method: "POST",
                body: formData,
            });

            clearInterval(interval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Upload failed");
            }

            const result = await response.json();
            setUploadProgress(100);
            showToast("File uploaded successfully to Drive", "success");

            if (onUploadSuccess) {
                onUploadSuccess(result.file);
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            showToast(error.message || "Failed to upload file", "error");
        } finally {
            setIsUploading(false);
            // Reset progress after a delay
            setTimeout(() => setUploadProgress(0), 1000);
        }
    }, [onUploadSuccess, showToast]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        maxFiles: 1,
        disabled: isUploading,
    });

    return (
        <div className={cn("w-full", className)}>
            <div
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer flex flex-col items-center justify-center gap-4 text-center",
                    isDragActive
                        ? "border-blue-500 bg-blue-500/5"
                        : "border-slate-200 hover:border-blue-500/50 hover:bg-slate-50",
                    isUploading && "pointer-events-none opacity-50"
                )}
            >
                <input {...getInputProps()} />

                <div className="p-4 rounded-full bg-slate-100">
                    {isUploading ? (
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    ) : (
                        <Upload className="w-8 h-8 text-slate-400" />
                    )}
                </div>

                <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-700">
                        {isUploading ? "Uploading..." : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-slate-500">
                        Support for single file upload to Google Drive
                    </p>
                </div>

                {uploadProgress > 0 && (
                    <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                        <div
                            className="bg-blue-500 h-full transition-all duration-300 ease-out"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
