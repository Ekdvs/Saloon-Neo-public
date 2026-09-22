export interface RequestUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatar: string | null;
    role: string;
    status: string;
    emailVerified: boolean;
    privileges: string[];
    createdAt: Date;
    updatedAt: Date;
    lastLogin: Date | null;
}

