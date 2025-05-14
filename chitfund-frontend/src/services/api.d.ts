interface Member {
  id?: number;
  name: string;
  phone: string;
  email: string;
  address: string;
}

interface Group {
  id?: number;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  memberCount: number;
}

interface Collection {
  id?: number;
  groupId: number;
  memberId: number;
  amount: number;
  date: string;
  status: string;
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
} 