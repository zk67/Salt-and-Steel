export interface Player {
    id: string;
    name: string;
    imageUrl?: string;
    x: number;
    y: number;
    energy: number;
    speed: number | null;
    life: number | null;
    attack: number | null;
    defense: number | null;
    d6target: 'attack' | 'defense' | null;
}
