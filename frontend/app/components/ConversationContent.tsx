'use client';

import React from 'react';

import AudioRecorder from './AudioRecorder';
import { ConversationFetchItem } from './ConversationSidebar';
import Conversation from './Conversation';

import styles from "./styles/conversation.module.css";

// ---------------------------------------------------------------- //
// interfaces
// ---------------------------------------------------------------- //

interface ConversationContainerProps {
    currentContext: ConversationFetchItem | null;
};


// ---------------------------------------------------------------- //
// Conversation Component
// ---------------------------------------------------------------- //

function ConversationContainer({currentContext}: ConversationContainerProps) {

    return (
        <div className={styles["container"]} >
            <div style={{height: "50%"}}>
                <AudioRecorder currentContext={currentContext}/>
            </div>
            <div style={{height: "50%"}}>
                <Conversation currentContext={currentContext}/>
            </div>
        </div>  
    );
}

export type { ConversationContainerProps };
export default ConversationContainer;