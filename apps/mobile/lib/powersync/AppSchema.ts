import { column, Schema, Table } from '@powersync/react-native';

const profiles = new Table(
  {
    // id column (text) is automatically included
    display_name: column.text,
    avatar_url: column.text,
    preferences: column.text,
    created_at: column.text,
    updated_at: column.text
  },
  { indexes: {} }
);

const wallets = new Table(
  {
    // id column (text) is automatically included
    user_id: column.text,
    name: column.text,
    type: column.text,
    currency: column.text,
    initial_balance: column.text,
    color: column.text,
    icon: column.text,
    is_active: column.integer,
    display_order: column.integer,
    created_at: column.text,
    updated_at: column.text
  },
  { indexes: {} }
);

const transactions = new Table(
  {
    // id column (text) is automatically included
    user_id: column.text,
    wallet_id: column.text,
    amount: column.text,
    type: column.text,
    category_id: column.text,
    transfer_to_wallet_id: column.text,
    linked_transaction_id: column.text,
    description: column.text,
    merchant: column.text,
    notes: column.text,
    transaction_date: column.text,
    location_latitude: column.text,
    location_longitude: column.text,
    location_name: column.text,
    receipt_image_url: column.text,
    metadata: column.text,
    created_at: column.text,
    updated_at: column.text
  },
  { indexes: {} }
);

const categories = new Table(
  {
    // id column (text) is automatically included
    user_id: column.text,
    name: column.text,
    icon: column.text,
    color: column.text,
    parent_id: column.text,
    type: column.text,
    is_active: column.integer,
    display_order: column.integer,
    created_at: column.text,
    updated_at: column.text
  },
  { indexes: {} }
);

const tags = new Table(
  {
    // id column (text) is automatically included
    user_id: column.text,
    name: column.text,
    color: column.text,
    created_at: column.text
  },
  { indexes: {} }
);

const transaction_tags = new Table(
  {
    // id column (text) is automatically included
    transaction_id: column.text,
    tag_id: column.text,
    user_id: column.text
  },
  { indexes: {} }
);

const proposed_transactions = new Table(
  {
    user_id: column.text,
    // Source metadata
    source_type: column.text,
    source_app: column.text,
    source_text: column.text,
    source_image_uri: column.text,
    notification_title: column.text,
    notification_body: column.text,
    notification_received_at: column.text,
    // AI analysis
    ai_reasoning: column.text,
    ai_confidence: column.text,
    // Proposed transaction fields
    wallet_id: column.text,
    wallet_hint: column.text,
    amount: column.text,
    currency: column.text,
    type: column.text,
    description: column.text,
    merchant: column.text,
    category_id: column.text,
    category_hint: column.text,
    transaction_date: column.text,
    // Lifecycle
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: {} }
);

export const AppSchema = new Schema({
  profiles,
  wallets,
  transactions,
  categories,
  tags,
  transaction_tags,
  proposed_transactions,
});

export type Database = (typeof AppSchema)['types'];
