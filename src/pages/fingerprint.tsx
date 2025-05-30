import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import useSubspace from "@/hooks/subspace";
import type { Message, Server } from "@/types/subspace";
import { ArrowRight, Search, ExternalLink, Copy, Check, Loader2, AlertCircle, MessageSquare, Server as ServerIcon, User, Calendar, Hash } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useParams, useNavigate } from "react-router";
import viewBlock from "@/assets/logos/viewblock.ico"
import aolink from "@/assets/logos/aolink.svg"

async function runGQLQuery(query: string) {
    const response = await fetch("https://arnode.asia/graphql", {
        "headers": {
            "accept": "*/*",
            "content-type": "application/json",
        },
        "body": JSON.stringify({ query }),
        "method": "POST",
    });
    return response.json()
}

export default function Fingerprint() {
    const { fingerprint } = useParams()
    const navigate = useNavigate()
    const [inputFingerprint, setInputFingerprint] = useState(fingerprint || "")
    const [content, setContent] = useState<string>("")
    const [serverId, setServerId] = useState<string>("")
    const [ownerAddress, setOwnerAddress] = useState<string>("")
    const [server, setServer] = useState<Server | null>(null)
    const [message, setMessage] = useState<Message | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set())
    const [messageEdits, setMessageEdits] = useState<any[]>([])
    const [loadingEdits, setLoadingEdits] = useState(false)
    const [deletionInfo, setDeletionInfo] = useState<any>(null)
    const [loadingDeletion, setLoadingDeletion] = useState(false)
    const subspace = useSubspace()

    // Define type for message edit
    interface MessageEdit {
        id: string
        content: string
        timestamp: number
        author: string
        editTxId: string
    }

    // Define type for deletion info
    interface DeletionInfo {
        deletedBy: string
        deletionTxId: string
        deletionTimestamp: number
        originalMessageId: number
    }

    const copyToClipboard = async (text: string, itemId: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedItems(prev => new Set(prev).add(itemId))
            setTimeout(() => {
                setCopiedItems(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(itemId)
                    return newSet
                })
            }, 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    const fetchMessageEdits = async (serverId: string, messageTxId: string, messageId: number) => {
        setLoadingEdits(true)
        try {
            const query = `query {
  transactions(
    tags: [
      { name: "App-Name", values: ["Subspace-Chat"] },
			{ name: "Data-Protocol", values: ["ao"] },
      { name:"Subspace-Function",values:["Update-Message"]},
      { name: "Subspace-Server-ID", values: ["${serverId}"] },
      { name: "Subspace-Original-Message-ID", values: ["${messageTxId}"] },
    ],
    sort:HEIGHT_DESC
  ) {
    edges {
      node {
        block{height},
        recipient
        owner{
          address
        }
        id,
        tags{
          name,value
        }
      }
    }
  }}`

            const data = await runGQLQuery(query)
            console.log("edits:", data)

            if (data?.data?.transactions?.edges) {
                const edits: MessageEdit[] = data.data.transactions.edges.map((edge: any) => {
                    const node = edge.node
                    const tags = node.tags?.reduce((acc: Record<string, string>, tag: { name: string, value: string }) => {
                        acc[tag.name] = tag.value;
                        return acc;
                    }, {});

                    return {
                        id: messageId.toString(),
                        content: tags["X-Body-content"] || "",
                        timestamp: parseInt(tags["Subspace-Timestamp-Milliseconds"] || "0"),
                        author: node.owner?.address || "",
                        editTxId: node.id
                    }
                })

                // Sort by timestamp (newest first)
                edits.sort((a, b) => b.timestamp - a.timestamp)
                setMessageEdits(edits)
            } else {
                setMessageEdits([])
            }
        } catch (err) {
            console.error('Failed to fetch message edits:', err)
            setMessageEdits([])
        } finally {
            setLoadingEdits(false)
        }
    }

    const checkMessageDeletion = async (messageTxId: string) => {
        setLoadingDeletion(true)
        try {
            const query = `query {
  transactions(
    tags: [
      { name: "App-Name", values: ["Subspace-Chat"] }
			{ name: "Data-Protocol", values: ["ao"] }
      { name:"Subspace-Function",values:["Delete-Message"]},
      { name:"Subspace-Original-Message-ID",values:["${messageTxId}"]},
    ],
    sort:HEIGHT_DESC
  ) {
    edges {
      node {
        block{height},
        recipient
        owner{
          address
        }
        id,
        tags{
          name,value
        }
      }
    }
  }
}`

            const data = await runGQLQuery(query)
            console.log("deletion check:", data)

            if (data?.data?.transactions?.edges?.length > 0) {
                const node = data.data.transactions.edges[0].node
                const tags = node.tags?.reduce((acc: Record<string, string>, tag: { name: string, value: string }) => {
                    acc[tag.name] = tag.value;
                    return acc;
                }, {});

                const deletionInfo: DeletionInfo = {
                    deletedBy: node.owner?.address || "",
                    deletionTxId: node.id,
                    deletionTimestamp: parseInt(tags["Subspace-Timestamp-Milliseconds"] || "0"),
                    originalMessageId: parseInt(tags["X-Body-messageId"] || "0")
                }

                setDeletionInfo(deletionInfo)

                // If we have the original message ID and server ID, automatically fetch edit history
                if (deletionInfo.originalMessageId && serverId) {
                    console.log(`Fetching edit history for deleted message ID: ${deletionInfo.originalMessageId}`)
                    await fetchMessageEdits(serverId, messageTxId, deletionInfo.originalMessageId)
                }

                return deletionInfo
            } else {
                setDeletionInfo(null)
                return null
            }
        } catch (err) {
            console.error('Failed to check message deletion:', err)
            setDeletionInfo(null)
            return null
        } finally {
            setLoadingDeletion(false)
        }
    }

    const searchFingerprint = async (fingerprintId: string) => {
        if (!fingerprintId.trim()) {
            setError("Please enter a fingerprint ID")
            return
        }

        setLoading(true)
        setError(null)
        setContent("")
        setServerId("")
        setOwnerAddress("")
        setServer(null)
        setMessage(null)
        setDeletionInfo(null)
        setMessageEdits([])

        const query = `query {
            transactions(
                ids:"${fingerprintId}"
                tags: [
                    { name: "App-Name", values: ["Subspace-Chat"] }
                    { name: "Data-Protocol", values: ["ao"] }
                ],
                sort:HEIGHT_DESC
              ) {
                edges {
                  node {
                    owner{address}
                    recipient
                    block {
                      timestamp
                    }
                    tags{
                      name,value
                    }
                  }
                }}}`

        try {
            const data = await runGQLQuery(query)

            if (!data?.data?.transactions?.edges?.length) {
                setError("No message found with this fingerprint ID")
                setLoading(false)
                return
            }

            const node = data.data.transactions.edges[0].node
            const tags = node.tags?.reduce((acc: Record<string, string>, tag: { name: string, value: string }) => {
                acc[tag.name] = tag.value;
                return acc;
            }, {});

            const messageContent = tags["X-Body-content"] || ""
            const messageServerId = tags["Subspace-Server-ID"] || ""
            const messageOwnerAddress = node.owner?.address || ""

            setContent(messageContent)
            setOwnerAddress(messageOwnerAddress)
            setServerId(messageServerId)

            if (messageServerId) {
                try {
                    const serverDetails = await subspace.server.getServerDetails({ serverId: messageServerId })
                    if (serverDetails) setServer(serverDetails as Server)

                    const msg = await subspace.server.message.getMessage({ serverId: messageServerId, messageTxId: fingerprintId })
                    // console.log(msg)
                    if (msg) {
                        setMessage(msg as Message)
                        // If message has been edited, fetch the edit history
                        if (msg.edited == 1) {
                            fetchMessageEdits(messageServerId, msg.messageTxId, msg.messageId)
                        }
                    }
                } catch (err) {
                    console.error("Failed to fetch server details:", err)
                    // If getMessage fails, check if the message was deleted
                    await checkMessageDeletion(fingerprintId)
                }
            }

            // Update URL without triggering navigation
            window.history.replaceState({}, '', `/#/fingerprint/${fingerprintId}`)
        } catch (err) {
            setError("Failed to fetch message details. Please try again.")
            console.error("Error fetching fingerprint:", err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (fingerprint) {
            setInputFingerprint(fingerprint)
            searchFingerprint(fingerprint)
        }
    }, [fingerprint])

    const handleSearch = () => {
        if (inputFingerprint.trim()) {
            searchFingerprint(inputFingerprint.trim())
        }
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch()
        }
    }

    const formatTimestamp = (timestamp: number) => {
        // Check if timestamp is in seconds (10 digits) or milliseconds (13 digits)
        const timestampInMs = timestamp > 9999999999 ? timestamp : timestamp * 1000
        return new Date(timestampInMs).toLocaleString()
    }

    const aolinkMessage = `https://aolink.ar.io/#/message/${fingerprint || inputFingerprint}`
    const aoLinkServer = serverId ? `https://aolink.ar.io/#/entity/${serverId}` : ""
    const aoLinkOwner = ownerAddress ? `https://aolink.ar.io/#/entity/${ownerAddress}` : ""
    const viewBlockOwner = ownerAddress ? `https://viewblock.io/arweave/address/${ownerAddress}` : ""

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-background/90 relative overflow-hidden">
            <title>Subspace | Message Fingerprint</title>

            {/* Background decorative elements to match app theme */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.05),transparent_50%)] pointer-events-none" />

            {/* Header */}
            <div className="bg-gradient-to-b from-background via-background/95 to-background/90 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10 relative">
                {/* Header glow effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-primary/5 rounded-full blur-2xl" />

                <div className="container mx-auto px-4 py-4 relative">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center backdrop-blur-sm border border-primary/20">
                                <Hash className="h-4 w-4 text-primary" />
                            </div>
                            <h1 className="text-2xl font-semibold text-foreground">Message Fingerprint</h1>
                        </div>
                        <NavLink to="/app">
                            <Button variant="ghost" size="sm" className="rounded-xl hover:bg-muted/50 transition-all duration-200">
                                <ArrowRight className="h-4 w-4 mr-2" />
                                Go to App
                            </Button>
                        </NavLink>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8 max-w-4xl relative z-10">
                {/* Search Section */}
                <div className="mb-8 relative">
                    {/* Card glow effect */}
                    <div className="absolute inset-0 bg-muted/20 rounded-2xl blur-xl scale-105" />

                    <div className="relative bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl">
                        <div className="p-6">
                            <div className="flex items-center space-x-2 mb-2">
                                <Search className="h-5 w-5 text-primary" />
                                <h2 className="text-lg font-semibold text-foreground">Search Message by Fingerprint</h2>
                            </div>
                            <p className="text-muted-foreground mb-6">
                                Enter a transaction fingerprint ID to view message details and server information
                            </p>

                            <div className="flex space-x-3">
                                <div className="flex-1 relative">
                                    <Input
                                        placeholder="Enter fingerprint ID (e.g., abcd1234...)"
                                        value={inputFingerprint}
                                        onChange={(e) => setInputFingerprint(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        className="bg-background/50 border-border/50 rounded-xl h-12 px-4 backdrop-blur-sm transition-all duration-200 focus:border-primary/50 focus:bg-background/80"
                                        disabled={loading}
                                    />
                                </div>
                                <Button
                                    onClick={handleSearch}
                                    disabled={loading || !inputFingerprint.trim()}
                                    className="px-6 h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Search className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            {error && (
                                <div className="mt-4 flex items-center space-x-2 text-red-400 bg-red-500/10 px-4 py-3 rounded-xl border border-red-500/20">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                    <span className="text-sm">{error}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="mb-8 relative">
                        <div className="absolute inset-0 bg-muted/20 rounded-2xl blur-xl scale-105" />
                        <div className="relative bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl">
                            <div className="flex items-center justify-center py-16">
                                <div className="text-center">
                                    <div className="relative mb-4">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                                        <div className="absolute inset-0 h-8 w-8 mx-auto bg-primary/20 rounded-full blur-xl animate-pulse" />
                                    </div>
                                    <p className="text-muted-foreground">Fetching message details...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Message Details */}
                {content && !loading && (
                    <div className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                        {/* Message Card - Consolidated message content and basic details */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-muted/20 rounded-2xl blur-xl scale-105" />
                            <div className="relative bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl">
                                <div className="p-6">
                                    <div className="flex items-center space-x-2 mb-4">
                                        <MessageSquare className="h-5 w-5 text-primary" />
                                        <h2 className="text-lg font-semibold text-foreground">Message</h2>
                                        {message?.edited > 0 && (
                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                                                Edited
                                            </Badge>
                                        )}
                                        {deletionInfo && (
                                            <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                                                Deleted
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Message Content */}
                                    <div className="bg-background/50 rounded-xl p-4 border border-border/30 backdrop-blur-sm mb-4">
                                        <p className="text-foreground whitespace-pre-wrap break-words leading-relaxed">
                                            {content}
                                        </p>
                                    </div>

                                    {/* Deletion Information */}
                                    {deletionInfo && (
                                        <div className="mb-4 p-4 bg-red-500/10 rounded-xl border border-red-500/20 backdrop-blur-sm">
                                            <div className="flex items-center space-x-2 mb-3">
                                                <AlertCircle className="h-4 w-4 text-red-500" />
                                                <p className="font-medium text-sm text-foreground">Message Deleted</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Deleted by</p>
                                                    <p className="text-sm font-mono text-red-600 dark:text-red-400">
                                                        {deletionInfo.deletedBy.slice(0, 8)}...{deletionInfo.deletedBy.slice(-8)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Deleted on</p>
                                                    <p className="text-sm text-red-600 dark:text-red-400">
                                                        {formatTimestamp(deletionInfo.deletionTimestamp)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs text-muted-foreground">Deletion Transaction</p>
                                                    <p className="text-xs font-mono text-red-600 dark:text-red-400">
                                                        {deletionInfo.deletionTxId.slice(0, 12)}...{deletionInfo.deletionTxId.slice(-12)}
                                                    </p>
                                                </div>
                                                <div className="flex space-x-2 ml-4">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(deletionInfo.deletionTxId, 'deletionTx')}
                                                        className="h-8 w-8 p-0 rounded-lg hover:bg-red-500/20"
                                                    >
                                                        {copiedItems.has('deletionTx') ? (
                                                            <Check className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4 text-red-500" />
                                                        )}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg hover:bg-red-500/20">
                                                        <a href={`https://aolink.ar.io/#/message/${deletionInfo.deletionTxId}`} target="_blank" rel="noopener noreferrer">
                                                            <img src={aolink} alt="AOLink" className="h-4" />
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Message Metadata */}
                                    {message && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="flex items-center space-x-3">
                                                <User className="h-4 w-4 text-muted-foreground" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs text-muted-foreground">Author</p>
                                                    <p className="text-sm font-mono text-foreground truncate" title={message.authorId}>
                                                        {message.authorId.slice(0, 8)}...{message.authorId.slice(-8)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-3">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Posted</p>
                                                    <p className="text-sm text-foreground">{formatTimestamp(message.timestamp)}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-3">
                                                <Hash className="h-4 w-4 text-muted-foreground" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs text-muted-foreground">Message ID</p>
                                                    <p className="text-sm text-foreground">#{message.messageId}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Reply Information */}
                                    {message?.replyTo && (
                                        <div className="mt-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 backdrop-blur-sm">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <MessageSquare className="h-4 w-4 text-blue-500" />
                                                <p className="font-medium text-sm text-foreground">Reply to Message #{message.replyTo}</p>
                                            </div>
                                            {message.replyToMessage && (
                                                <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                                                    <p className="text-sm text-foreground mb-1">{message.replyToMessage.content}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        By {message.replyToMessage.authorId.slice(0, 8)}...{message.replyToMessage.authorId.slice(-8)} • {formatTimestamp(message.replyToMessage.timestamp)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Attachments */}
                                    {message?.attachments && message.attachments !== "[]" && message.attachments !== "" && (
                                        <div className="mt-4 p-4 bg-green-500/10 rounded-xl border border-green-500/20 backdrop-blur-sm">
                                            <div className="flex items-center space-x-2">
                                                <ExternalLink className="h-4 w-4 text-green-500" />
                                                <p className="font-medium text-sm text-foreground">Attachments</p>
                                            </div>
                                            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                                                {message.attachments}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Edit History Card */}
                        {(message?.edited > 0 || (deletionInfo && messageEdits.length > 0)) && (
                            <div className="relative">
                                <div className="absolute inset-0 bg-muted/20 rounded-2xl blur-xl scale-105" />
                                <div className="relative bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl">
                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center space-x-2">
                                                <Calendar className="h-5 w-5 text-amber-500" />
                                                <h2 className="text-lg font-semibold text-foreground">Edit History</h2>
                                                {deletionInfo && (
                                                    <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 text-xs">
                                                        From Deleted Message
                                                    </Badge>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    if (deletionInfo && deletionInfo.originalMessageId) {
                                                        fetchMessageEdits(serverId, fingerprint || inputFingerprint, deletionInfo.originalMessageId)
                                                    } else if (message) {
                                                        fetchMessageEdits(serverId, message.messageTxId, message.messageId)
                                                    }
                                                }}
                                                disabled={loadingEdits}
                                                className="h-8 px-3 rounded-lg hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                            >
                                                {loadingEdits ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    "Refresh Edits"
                                                )}
                                            </Button>
                                        </div>

                                        {messageEdits.length > 0 ? (
                                            <div className="space-y-3">
                                                {messageEdits.map((edit, index) => (
                                                    <div key={index} className="p-4 bg-background/50 rounded-xl border border-border/30">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center space-x-2">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    Edit #{messageEdits.length - index}
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatTimestamp(edit.timestamp)}
                                                                </span>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => copyToClipboard(edit.editTxId, `edit-${index}`)}
                                                                className="h-6 w-6 p-0 rounded hover:bg-muted/50"
                                                                title="Copy edit transaction ID"
                                                            >
                                                                {copiedItems.has(`edit-${index}`) ? (
                                                                    <Check className="h-3 w-3 text-green-500" />
                                                                ) : (
                                                                    <Copy className="h-3 w-3" />
                                                                )}
                                                            </Button>
                                                        </div>
                                                        <div className="bg-background/80 rounded-lg p-3 border border-border/20">
                                                            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                                                                {edit.content}
                                                            </p>
                                                        </div>
                                                        <div className="mt-2 text-xs text-muted-foreground">
                                                            Tx: {edit.editTxId.slice(0, 12)}...{edit.editTxId.slice(-12)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <p className="text-muted-foreground">
                                                    {deletionInfo
                                                        ? "Click \"Refresh Edits\" to load edit history for this deleted message"
                                                        : "Click \"Refresh Edits\" to load edit history"
                                                    }
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Technical Details Card - Consolidated transaction and blockchain info */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-muted/20 rounded-2xl blur-xl scale-105" />
                            <div className="relative bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl">
                                <div className="p-6">
                                    <div className="flex items-center space-x-2 mb-4">
                                        <Hash className="h-5 w-5 text-primary" />
                                        <h2 className="text-lg font-semibold text-foreground">Transaction Details</h2>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Transaction ID (Fingerprint) */}
                                        <div className="flex items-center justify-between p-4 bg-background/30 rounded-xl border border-border/30 backdrop-blur-sm">
                                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-sm text-foreground">Transaction ID</p>
                                                    <p className="text-xs text-muted-foreground font-mono break-all">{fingerprint || inputFingerprint}</p>
                                                </div>
                                            </div>
                                            <div className="flex space-x-2 ml-4">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => copyToClipboard(fingerprint || inputFingerprint, 'fingerprint')}
                                                    className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50"
                                                >
                                                    {copiedItems.has('fingerprint') ? (
                                                        <Check className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50">
                                                    <a href={aolinkMessage} target="_blank" rel="noopener noreferrer">
                                                        <img src={aolink} alt="AOLink" className="h-4" />
                                                    </a>
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Author Address with Links */}
                                        {ownerAddress && (
                                            <div className="flex items-center justify-between p-4 bg-background/30 rounded-xl border border-border/30 backdrop-blur-sm">
                                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-sm text-foreground">Author Address</p>
                                                        <p className="text-xs text-muted-foreground font-mono break-all">{ownerAddress}</p>
                                                    </div>
                                                </div>
                                                <div className="flex space-x-2 ml-4">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(ownerAddress, 'owner')}
                                                        className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50"
                                                    >
                                                        {copiedItems.has('owner') ? (
                                                            <Check className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50">
                                                        <a href={aoLinkOwner} target="_blank" rel="noopener noreferrer" title="View on AOLink">
                                                            <img src={aolink} alt="AOLink" className="h-4" />
                                                        </a>
                                                    </Button>
                                                    <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50">
                                                        <a href={viewBlockOwner} target="_blank" rel="noopener noreferrer" title="View on ViewBlock">
                                                            <img src={viewBlock} alt="ViewBlock" className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Channel Info */}
                                        {message && (
                                            <div className="p-4 bg-background/30 rounded-xl border border-border/30 backdrop-blur-sm">
                                                <div className="flex items-center space-x-3">
                                                    <Hash className="h-4 w-4 text-muted-foreground" />
                                                    <div>
                                                        <p className="font-medium text-sm text-foreground">Channel ID</p>
                                                        <p className="text-sm text-muted-foreground">{message.channelId}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Server Information Card - Cleaned up */}
                        {server && (
                            <div className="relative">
                                <div className="absolute inset-0 bg-muted/20 rounded-2xl blur-xl scale-105" />
                                <div className="relative bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl">
                                    <div className="p-6">
                                        <div className="flex items-center space-x-2 mb-4">
                                            <ServerIcon className="h-5 w-5 text-primary" />
                                            <h2 className="text-lg font-semibold text-foreground">Server Information</h2>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Server Header */}
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="text-xl font-semibold text-foreground">{server.name}</h3>
                                                    <p className="text-sm text-muted-foreground">{server.member_count} members</p>
                                                </div>
                                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                                    Public
                                                </Badge>
                                            </div>

                                            {/* Server Details */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-4 bg-background/30 rounded-xl border border-border/30 backdrop-blur-sm">
                                                    <div className="flex items-center space-x-3">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-medium text-sm text-foreground">Server Owner</p>
                                                            <p className="text-xs text-muted-foreground font-mono break-all">{server.owner}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-background/30 rounded-xl border border-border/30 backdrop-blur-sm">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                            <ServerIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-medium text-sm text-foreground">Server ID</p>
                                                                <p className="text-xs text-muted-foreground font-mono break-all">{serverId}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex space-x-2 ml-4">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => copyToClipboard(serverId, 'server')}
                                                                className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50"
                                                            >
                                                                {copiedItems.has('server') ? (
                                                                    <Check className="h-4 w-4 text-green-500" />
                                                                ) : (
                                                                    <Copy className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                            {aoLinkServer && (
                                                                <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg hover:bg-muted/50">
                                                                    <a href={aoLinkServer} target="_blank" rel="noopener noreferrer">
                                                                        <img src={aolink} alt="AOLink" className="h-4" />
                                                                    </a>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* No Results State */}
                {!content && !loading && inputFingerprint && !error && (
                    <div className="relative">
                        <div className="absolute inset-0 bg-muted/20 rounded-2xl blur-xl scale-105" />
                        <div className="relative bg-gradient-to-br from-background/80 to-background/40 backdrop-blur-sm border border-border/50 rounded-2xl shadow-xl">
                            <div className="text-center py-16">
                                <div className="relative mb-4">
                                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
                                    <div className="absolute inset-0 h-12 w-12 mx-auto bg-muted-foreground/10 rounded-full blur-xl" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground mb-2">No Message Found</h3>
                                <p className="text-muted-foreground max-w-md mx-auto">
                                    No Subspace message found with this fingerprint ID. Please check the ID and try again.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}