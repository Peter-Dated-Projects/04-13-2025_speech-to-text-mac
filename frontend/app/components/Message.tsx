



// ---------------------------------------------------------------- //
// interfaces
// ---------------------------------------------------------------- //

interface MessageProps {
    message: string;
    audioURL: string;
    userID: string;
}

// ---------------------------------------------------------------- //
// Message Component
// ---------------------------------------------------------------- //

function Message({ message, userID, audioURL }: MessageProps) {
    return (
        <div>
            Hello from {userID}!
        </div>
    );
}