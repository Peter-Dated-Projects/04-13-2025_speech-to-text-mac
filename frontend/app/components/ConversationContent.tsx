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

// ---------------------------------------------------------------- //
// Conversation Component
// ---------------------------------------------------------------- //

function ConversationContainer({ currentContext, userInfo }: ConversationContainerProps) {
  return (
    <div className={styles["container"]}>
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
