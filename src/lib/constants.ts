import type { Tag } from "@/types/ao";


export class Constants {
    static readonly TagNames = {
        AppName: "App-Name",
        AppVersion: "App-Version",
        SubspaceFunction: "Subspace-Function",
    };
    static readonly TagValues = {
        AppName: "Subspace-Chat",
        // @ts-ignore
        AppVersion: `${__VERSION__}`,

        CreateServer: "Create-Server",
        CreateCategory: "Create-Category",
        CreateChannel: "Create-Channel",
        SendMessage: "Send-Message",

        UpdateServer: "Update-Server",
        UpdateServerCode: "Update-Server-Code",
        UpdateProfile: "Update-Profile",
        UpdateMember: "Update-Member",
        UpdateCategory: "Update-Category",
        UpdateChannel: "Update-Channel",
        UpdateMessage: "Update-Message",

        DeleteServer: "Delete-Server",
        DeleteCategory: "Delete-Category",
        DeleteChannel: "Delete-Channel",
        DeleteMessage: "Delete-Message",
        DeleteMember: "Delete-Member",

        CreateRole: "Create-Role",
        UpdateRole: "Update-Role",
        DeleteRole: "Delete-Role",
        AssignRole: "Assign-Role",
        UnassignRole: "Unassign-Role",

        JoinServer: "Join-Server",
        LeaveServer: "Leave-Server",
        ReorderServers: "Reorder-Servers",

        DelegateUser: "Delegate-User",
        UndelegateUser: "Undelegate-User",

        SendFriendRequest: "Send-Friend-Request",
        AcceptFriendRequest: "Accept-Friend-Request",
        RejectFriendRequest: "Reject-Friend-Request",
        RemoveFriend: "Remove-Friend",

        InitiateDm: "Initiate-Dm",
        SendDm: "Send-Dm",

        UploadFileAR: "Upload-File-AR",
        UploadFileTurbo: "Upload-File-Turbo",
    };

    static readonly TKey = "AIzaSyAPpbqyilDRCuMQ-on7V76t6CS10lKTwUs";

    static readonly Scheduler = "_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA";
    static readonly Module = "33d-3X8mpv6xYBlVB-eXMrPfH5Kzf6Hiwhcv0UA10sw";

    static readonly Profiles = "J-GI_SARbZ8O0km4JiE2lu2KJdZIWMo53X3HrqusXjY";

    // @ts-ignore
    static readonly AOXPRESS_SOURCE = `${__AOXPRESS_SRC__}`;
    // @ts-ignore
    static readonly SERVER_SOURCE = `${Constants.AOXPRESS_SOURCE}\n\n${__SERVER_SRC__}`;

    static readonly CuEndpoints = [
        // "https://cu.randao.net/",
        "https://cu.arnode.asia",
        "https://cu.ardrive.io",
    ]

    static readonly CommonTags: Tag[] = [
        { name: Constants.TagNames.AppName, value: Constants.TagValues.AppName },
        { name: Constants.TagNames.AppVersion, value: Constants.TagValues.AppVersion },
        { name: "Authority", value: "fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY" }
    ]
}