"use client";

import React from "react";

import AudioRecorder from "./AudioRecorder";
import { ConversationFetchItem } from "./ConversationSidebar";
import Conversation from "./Conversation";

import styles from "./styles/conversation.module.css";

import { UserInformation } from "../page";

// ---------------------------------------------------------------- //
// interfaces
// ---------------------------------------------------------------- //

interface ConversationContainerProps {
  currentContext: ConversationFetchItem | null;
  userInfo: UserInformation;
}

interface HandleNameEditProps {
  editValue: string;
  bool: boolean;
}

// ---------------------------------------------------------------- //
// function
// -- ------------------------------------------------------------- //

// ---------------------------------------------------------------- //
// Conversation Component
// ---------------------------------------------------------------- //

function ConversationContainer({ currentContext, userInfo }: ConversationContainerProps) {
  const [isEditingName, setIsEditingName] = React.useState<string>("s");
  const [isEditing, setIsEditing] = React.useState<boolean>(false);

  // functions
  function HandleNameEdit({ flag, editValue }: HandleNameEditProps) {
    return (
      <div className={styles["container-item"]} style={{ width: "100%" }}>
        {editValue}
      </div>
    );
  }

  // Effects

  React.useEffect(() => {
    // Grab the context conversation name
    if (currentContext) {
      setIsEditingName(currentContext.title);
    } else {
      setIsEditingName("");
    }
  }, [currentContext]);

  // Return the Component

  return (
    <div className={styles["container"]}>
      <div className={styles["container-header"]}>
        <HandleNameEdit flag={isEditing} editValue={isEditingName} />
      </div>
      <div>
        <AudioRecorder currentContext={currentContext} userInfo={userInfo} />
      </div>
      <div>
        <Conversation currentContext={currentContext} userInfo={userInfo} />
      </div>
    </div>
  );
}

export type { ConversationContainerProps };
export default ConversationContainer;
