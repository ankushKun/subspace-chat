import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { DropzoneOptions } from 'react-dropzone';
import { Upload, X } from 'lucide-react';

export interface FileDropzoneProps {
    onFileChange: (file: File | null) => void;
    currentFile?: string;
    maxSize?: number;
    label?: string;
    accept?: Record<string, string[]>;
    className?: string;
    previewType?: 'circle' | 'square';
    placeholder?: string;
    showFileInfo?: boolean;
    arweaveUrlPrefix?: string;
}

export function FileDropzone({
    onFileChange,
    currentFile,
    maxSize = 100 * 1024, // Default 100KB
    label = 'File',
    accept = { 'image/*': ['.jpeg', '.jpg', '.png', '.gif'] },
    className = '',
    previewType = 'square',
    placeholder = 'Drag & drop or click to select',
    showFileInfo = true,
    arweaveUrlPrefix = 'https://arweave.net/'
}: FileDropzoneProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);

    const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
        // Clear previous errors
        setFileError(null);

        // Handle file rejections (e.g., file size, type)
        if (fileRejections.length > 0) {
            const { code, message } = fileRejections[0].errors[0];
            if (code === 'file-too-large') {
                setFileError(`File is too large. Maximum size is ${formatFileSize(maxSize)}.`);
            } else {
                setFileError(message);
            }
            return;
        }

        if (acceptedFiles && acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setSelectedFile(file);
            onFileChange(file);

            // Create preview for the file
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }, [onFileChange, maxSize]);

    const dropzoneOptions: DropzoneOptions = {
        onDrop,
        accept,
        maxFiles: 1,
        maxSize,
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

    const removeFile = () => {
        setSelectedFile(null);
        setPreview(null);
        setFileError(null);
        onFileChange(null);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const maxSizeFormatted = formatFileSize(maxSize);

    return (
        <div className={`w-full space-y-2 ${className}`}>
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-foreground">{label}</label>
                <span className="text-xs text-muted-foreground">Max {maxSizeFormatted}</span>
            </div>

            {!selectedFile ? (
                <div
                    {...getRootProps()}
                    className={`
            border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer
            flex flex-col items-center justify-center min-h-[120px]
            ${isDragActive
                            ? 'border-primary bg-primary/5'
                            : fileError
                                ? 'border-destructive/50 bg-destructive/5'
                                : 'border-muted-foreground/20 hover:border-muted-foreground/50'
                        }
          `}
                >
                    <input {...getInputProps()} />

                    {currentFile && !isDragActive && !fileError ? (
                        <div className={`w-20 h-20 ${previewType === 'circle' ? 'rounded-full' : 'rounded-md'} overflow-hidden mb-2`}>
                            <img
                                src={`${arweaveUrlPrefix}${currentFile}`}
                                alt="Current file"
                                className="h-full w-full object-cover"
                            />
                        </div>
                    ) : (
                        <Upload className={`h-6 w-6 mb-2 ${fileError ? 'text-destructive' : 'text-muted-foreground'}`} />
                    )}

                    {fileError ? (
                        <div className="text-center">
                            <p className="text-sm text-destructive font-medium">{fileError}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Try a smaller file (maximum {maxSizeFormatted})
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-center text-muted-foreground">
                            {isDragActive ? 'Drop your file here' : placeholder}
                        </p>
                    )}
                </div>
            ) : (
                <div className="relative bg-muted rounded-lg p-1">
                    <div className={`relative aspect-square w-full overflow-hidden ${previewType === 'circle' ? 'rounded-full mx-auto max-w-[180px]' : 'rounded-md'}`}>
                        {preview && (
                            <img
                                src={preview}
                                alt="Preview"
                                className="h-full w-full object-cover"
                            />
                        )}
                    </div>
                    {selectedFile && showFileInfo && (
                        <div className="absolute bottom-2 left-2 text-xs bg-black/70 text-white px-2 py-1 rounded-md">
                            {formatFileSize(selectedFile.size)}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={removeFile}
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-xs text-white shadow-sm"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
} 