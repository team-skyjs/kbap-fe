/**
 * useMe / useMyReviews — profile + my reviews (FR-024/025).
 * Same seam pattern as useHome.
 */
import { useQuery } from '@tanstack/react-query';
import type { Review, User } from '../api/types';
import { api } from '../api/client';
import { MOCK_MY_REVIEWS, MOCK_USER } from '../mocks/me';
import { MOCK_MODE } from './config';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: (): Promise<User> =>
      MOCK_MODE ? Promise.resolve(MOCK_USER) : api.get<User>('/me'),
  });
}

export function useMyReviews() {
  return useQuery({
    queryKey: ['me', 'reviews'],
    queryFn: (): Promise<Review[]> =>
      MOCK_MODE ? Promise.resolve(MOCK_MY_REVIEWS) : api.get<Review[]>('/me/reviews'),
  });
}
