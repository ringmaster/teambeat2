export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Board {
  id: string;
  name: string;
  seriesId: string;
  status: 'draft' | 'active' | 'closed';
  blameFreeMode: boolean;
  votingAllocation: number;
  currentSceneId?: string;
  createdAt?: string;
  updatedAt?: string;
  columns?: Column[];
  scenes?: Scene[];
}

export interface Scene {
  id: string;
  boardId: string;
  title: string;
  description?: string;
  mode: 'columns' | 'present' | 'review';
  seq: number;
  selectedCardId?: string | null;
  allowAddCards?: boolean;
  allowEditCards?: boolean;
  allowObscureCards?: boolean;
  allowMoveCards?: boolean;
  allowGroupCards?: boolean;
  showVotes?: boolean;
  allowVoting?: boolean;
  showComments?: boolean;
  allowComments?: boolean;
  createdAt?: string;
}

export interface Column {
  id: string;
  boardId: string;
  title: string;
  seq: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Card {
  id: string;
  columnId: string;
  userId?: string;
  content: string;
  notes?: string | null;
  groupId?: string | null;
  isGroupLead?: boolean;
  voteCount?: number;
  userVoted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  cardId: string;
  userId: string;
  userName?: string;
  content: string;
  isAgreement?: boolean;
  createdAt?: string;
}

export interface Vote {
  id: string;
  cardId: string;
  userId: string;
  createdAt?: string;
}
