/**
 * Pure helpers for the board's client-side state. No React here, so they're
 * easy to unit test.
 */
import { sortByPosition } from "@/lib/positions";
import type { Role } from "@/lib/permissions";
import type { Board, BoardData, Card, List, Member } from "@/types/app";

export type CardsByList = Record<string, Card[]>;

export type BoardState = {
  board: Board;
  lists: List[]; // sorted by position
  cardsByList: CardsByList; // each array sorted by position
  members: Member[];
  role: Role;
};

/** Group a flat list of cards by list id, each group sorted by position. */
export function groupCards(lists: readonly List[], cards: readonly Card[]): CardsByList {
  const grouped: CardsByList = Object.fromEntries(lists.map((l) => [l.id, [] as Card[]]));
  for (const card of cards) {
    (grouped[card.list_id] ??= []).push(card);
  }
  for (const id of Object.keys(grouped)) grouped[id] = sortByPosition(grouped[id]);
  return grouped;
}

export function toBoardState(data: BoardData): BoardState {
  return {
    board: data.board,
    lists: sortByPosition(data.lists),
    cardsByList: groupCards(data.lists, data.cards),
    members: data.members,
    role: data.role,
  };
}

/** Which list currently contains this card? */
export function findListIdOfCard(cardsByList: CardsByList, cardId: string): string | undefined {
  return Object.keys(cardsByList).find((listId) =>
    cardsByList[listId].some((card) => card.id === cardId),
  );
}

export function findCard(cardsByList: CardsByList, cardId: string): Card | undefined {
  for (const cards of Object.values(cardsByList)) {
    const card = cards.find((c) => c.id === cardId);
    if (card) return card;
  }
  return undefined;
}

/** Move a card into another list at `index` (pure: returns a new object). */
export function moveCardBetweenLists(
  cardsByList: CardsByList,
  cardId: string,
  toListId: string,
  index: number,
): CardsByList {
  const fromListId = findListIdOfCard(cardsByList, cardId);
  if (!fromListId) return cardsByList;
  const card = cardsByList[fromListId].find((c) => c.id === cardId)!;
  const fromItems = cardsByList[fromListId].filter((c) => c.id !== cardId);
  const target = fromListId === toListId ? fromItems : (cardsByList[toListId] ?? []);
  const clamped = Math.max(0, Math.min(index, target.length));
  const toItems = [
    ...target.slice(0, clamped),
    { ...card, list_id: toListId },
    ...target.slice(clamped),
  ];
  return { ...cardsByList, [fromListId]: fromItems, [toListId]: toItems };
}
