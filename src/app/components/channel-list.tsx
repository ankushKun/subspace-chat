import { useGlobalState } from "@/hooks/global-state";
import { ChevronDown, Loader2, FolderPlus, MessageSquarePlus, Settings, Upload, X } from "lucide-react";
import type { Server } from "@/lib/types";
import { useState, useCallback } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";

// File dropzone component for server icon
const FileDropzone = ({
    onFileChange
}: {
    onFileChange: (file: File | null) => void
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);

    // 100KB size limit in bytes
    const MAX_FILE_SIZE = 100 * 1024;

    const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
        // Clear previous errors
        setFileError(null);

        // Handle file rejections (e.g., file size, type)
        if (fileRejections.length > 0) {
            const { code, message } = fileRejections[0].errors[0];
            if (code === 'file-too-large') {
                setFileError(`File is too large. Maximum size is 100KB.`);
            } else {
                setFileError(message);
            }
            return;
        }

        if (acceptedFiles && acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            setSelectedFile(file);
            onFileChange(file);

            // Create preview for image
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }, [onFileChange]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.gif']
        },
        maxFiles: 1,
        maxSize: MAX_FILE_SIZE,
    });

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

    return (
        <div className="w-full space-y-2">
            <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-foreground">Server Icon</label>
                <span className="text-xs text-muted-foreground">Max 100KB</span>
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
                    <Upload className={`h-6 w-6 mb-2 ${fileError ? 'text-destructive' : 'text-muted-foreground'}`} />

                    {fileError ? (
                        <div className="text-center">
                            <p className="text-sm text-destructive font-medium">{fileError}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Try a smaller image (maximum 100KB)
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-center text-muted-foreground">
                            {isDragActive ? 'Drop your image here' : 'Drag & drop server icon or click to select'}
                        </p>
                    )}
                </div>
            ) : (
                <div className="relative bg-muted rounded-lg p-1">
                    <div className="relative aspect-square w-full overflow-hidden rounded-md">
                        {preview && (
                            <img
                                src={preview}
                                alt="Preview"
                                className="h-full w-full object-cover"
                            />
                        )}
                    </div>
                    {selectedFile && (
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
};

export default function ChannelList() {
    const { activeServer } = useGlobalState();
    const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
    const [createChannelOpen, setCreateChannelOpen] = useState(false);
    const [updateServerOpen, setUpdateServerOpen] = useState(false);

    // Form states
    const [categoryName, setCategoryName] = useState("");
    const [channelName, setChannelName] = useState("");
    const [serverName, setServerName] = useState("");
    const [serverIcon, setServerIcon] = useState<File | null>(null);

    const handleCreateCategory = () => {
        if (!categoryName.trim()) {
            return toast.error("Please enter a category name");
        }

        // Handle category creation logic here
        toast.success(`Category "${categoryName}" created`);
        setCategoryName("");
        setCreateCategoryOpen(false);
    };

    const handleCreateChannel = () => {
        if (!channelName.trim()) {
            return toast.error("Please enter a channel name");
        }

        // Handle channel creation logic here
        toast.success(`Channel "#${channelName}" created`);
        setChannelName("");
        setCreateChannelOpen(false);
    };

    const handleUpdateServer = () => {
        if (!serverName.trim()) {
            return toast.error("Please enter a server name");
        }

        // Handle server update logic here
        toast.success("Server details updated");
        setServerName("");
        setServerIcon(null);
        setUpdateServerOpen(false);
    };

    return (
        <div className="relative w-full">
            <DropdownMenu>
                <DropdownMenuTrigger asChild className="w-full">
                    <div className='w-full select-none border-b border-border/70 hover:bg-accent/40 rounded-t-lg p-3 px-4 flex items-center justify-between cursor-pointer'>
                        <div>{activeServer?.name || <Loader2 className='w-4 h-4 animate-spin' />}</div>
                        <ChevronDown className="w-4 h-4" />
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="w-full min-w-[333px] max-w-[333px] p-2 space-y-1 bg-background/95 backdrop-blur-sm"
                    sideOffset={4}
                >
                    <DropdownMenuItem
                        onClick={() => setCreateCategoryOpen(true)}
                        className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                    >
                        <FolderPlus className="h-5 w-5" />
                        <div>
                            <p className="font-medium">Create Category</p>
                            <p className="text-xs text-muted-foreground">Add a new category</p>
                        </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setCreateChannelOpen(true)}
                        className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                    >
                        <MessageSquarePlus className="h-5 w-5" />
                        <div>
                            <p className="font-medium">Create Channel</p>
                            <p className="text-xs text-muted-foreground">Add a new channel</p>
                        </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setUpdateServerOpen(true)}
                        className="cursor-pointer flex items-center gap-3 p-3 text-sm hover:bg-accent/40 rounded-md"
                    >
                        <Settings className="h-5 w-5" />
                        <div>
                            <p className="font-medium">Update Server Details</p>
                            <p className="text-xs text-muted-foreground">Edit name and icon</p>
                        </div>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Create Category Dialog */}
            <AlertDialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Add a new category to organize your channels.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <div className="space-y-2">
                            <label htmlFor="category-name" className="text-sm font-medium text-foreground">
                                Category Name
                            </label>
                            <Input
                                id="category-name"
                                placeholder="e.g. General Discussion"
                                value={categoryName}
                                onChange={(e) => setCategoryName(e.target.value)}
                            />
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCreateCategory}>Create</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Channel Dialog */}
            <AlertDialog open={createChannelOpen} onOpenChange={setCreateChannelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Create Channel</AlertDialogTitle>
                        <AlertDialogDescription>
                            Add a new channel to communicate with others.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="py-4">
                        <div className="space-y-2">
                            <label htmlFor="channel-name" className="text-sm font-medium text-foreground">
                                Channel Name
                            </label>
                            <Input
                                id="channel-name"
                                placeholder="e.g. general"
                                value={channelName}
                                onChange={(e) => setChannelName(e.target.value)}
                            />
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCreateChannel}>Create</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Update Server Dialog */}
            <AlertDialog open={updateServerOpen} onOpenChange={setUpdateServerOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Update Server Details</AlertDialogTitle>
                        <AlertDialogDescription>
                            Edit your server's name and icon.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="flex gap-4 py-4">
                        <div className="w-1/3">
                            <FileDropzone onFileChange={setServerIcon} />
                        </div>

                        <div className="flex-1 space-y-2">
                            <div className="space-y-2">
                                <label htmlFor="server-name" className="text-sm font-medium text-foreground">
                                    Server Name
                                </label>
                                <Input
                                    id="server-name"
                                    placeholder="My Awesome Server"
                                    value={serverName}
                                    onChange={(e) => setServerName(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleUpdateServer}>Update</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}