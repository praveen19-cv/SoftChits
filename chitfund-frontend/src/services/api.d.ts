interface Member {
  id?: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: 'active' | 'inactive';
}

interface Group {
  id?: number;
  name: string;
  total_amount: number;
  member_count: number;
  start_date: string;
  end_date: string;
  status: string;
}

interface Collection {
  id?: number;
  group_id: number;
  member_id: number;
  amount: number;
  collection_date: string;
  status: string;
}

interface GroupMember {
  id: number;
  group_member_id: string;
}

declare module '@/services/api' {
  export function getAllMembers(): Promise<Member[]>;
  export function getMemberById(id: number): Promise<Member>;
  export function createMember(member: Member): Promise<Member>;
  export function updateMember(id: number, member: Member): Promise<Member>;
  export function deleteMember(id: number): Promise<void>;

  export function getAllGroups(): Promise<Group[]>;
  export function getGroupById(id: number): Promise<Group>;
  export function createGroup(group: Group): Promise<Group>;
  export function updateGroup(id: number, group: Group): Promise<Group>;
  export function deleteGroup(id: number): Promise<void>;

  export function getAllCollections(): Promise<Collection[]>;
  export function getCollectionById(id: number): Promise<Collection>;
  export function createCollection(collection: Collection): Promise<Collection>;
  export function updateCollection(id: number, collection: Collection): Promise<Collection>;
  export function deleteCollection(id: number): Promise<void>;

  export function getGroupMembers(groupId: number): Promise<Member[]>;
  export function addGroupMember(groupId: number, memberId: number, groupMemberId: string): Promise<Member>;
  export function removeGroupMember(groupId: number, memberId: number): Promise<void>;
  export function updateGroupMembers(groupId: number, members: GroupMember[]): Promise<void>;
} 