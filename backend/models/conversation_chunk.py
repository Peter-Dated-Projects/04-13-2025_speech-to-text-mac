from datetime import datetime
from mongoengine import (
    Document,
    DateTimeField,
    ListField,
    ReferenceField,
    IntField
)

# Forward reference for models to avoid circular import issues if needed,
# though direct string names in ReferenceField are usually sufficient.
# class Conversation(Document): pass
# class Segment(Document): pass

class ConversationChunk(Document):
    meta = {
        "collection": "conversation_chunks",
        "indexes": [
            "conversation",
            "updated_at"
        ]
    }

    conversation = ReferenceField("Conversation", required=True)
    segments = ListField(ReferenceField("Segment")) # Max 10, will be enforced by application logic

    # Timestamp of the first message in the chunk
    created_at = DateTimeField(default=datetime.utcnow)
    # Timestamp of the last message in the chunk
    updated_at = DateTimeField(default=datetime.utcnow)

    message_count = IntField(default=0)

    def __str__(self):
        return f"Chunk for Conversation {self.conversation.id if self.conversation else 'None'} with {self.message_count} messages, updated at {self.updated_at}"
