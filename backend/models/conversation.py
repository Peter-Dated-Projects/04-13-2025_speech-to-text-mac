from datetime import datetime
from mongoengine import (
    Document,
    StringField,
    IntField,
    DateTimeField,
    ListField,
    BinaryField,
    ReferenceField,
    DecimalField,
    BooleanField,
)

# --------------------------------------------------------------------------- #
# conversation model
# --------------------------------------------------------------------------- #


class Conversation(Document):
    meta = {
        "collection": "conversations",
    }

    # information about conversations
    title = StringField(required=True)
    description = StringField()

    audio_data = BinaryField(required=True)
    audio_duration = DecimalField(required=True)
    compressed = BooleanField(default=False)
    segment_ids = ListField(ReferenceField("Segment"))

    created_at = DateTimeField(default=datetime.utcnow)
    updated_at = DateTimeField(default=datetime.utcnow)

    # keep track of number of users in the conversation
    participants = ListField(ReferenceField("User"))
