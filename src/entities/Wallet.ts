import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('wallets')
export class Wallet {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true })
    address!: string;

    @Column()
    hdPath!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 