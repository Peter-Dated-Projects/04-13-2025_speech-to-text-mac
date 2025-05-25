'use client';

import React from 'react';
import {ConversationContainerProps} from "./ConversationContent";

import styles from "./styles/conversation.module.css";


// ---------------------------------------------------------------- //
// interfaces
// ---------------------------------------------------------------- //




// ---------------------------------------------------------------- //
// Conversation Component
// ---------------------------------------------------------------- //

function Conversation({ currentContext }: ConversationContainerProps) {

    // states
    const [messages, setMessages] = React.useState<any[]>([]);
    console.log(currentContext);

    // functions


    // effects

    return (
        <div className={styles["container-item"]}>
            Hello World
        </div>
    );
}

export default Conversation;