import { adaptSelectedFoods } from '../selectedFoodsAdapter';
import { HOME_SELECTION } from '@/features/home/selectedFoods';
const ids = HOME_SELECTION.orderedFoodIds;
const item = (foodId: number, overallRiskStatus = 'UNKNOWN') => ({ foodId, name: `Food ${foodId}`, spiciness: 0, overallRiskStatus, bookmarked: false, review: { averageRating: 0, count: 0 } });
it('has exactly ten prod IDs, including the distinct soy crab, in editorial order', () => {
  expect(ids).toEqual([743,444,432,325,300,629,435,248,414,445]);
  expect(new Set(ids).size).toBe(10);
  const result = adaptSelectedFoods({ items: ids.map((id) => item(id)), unavailableFoodIds: [] }, ids);
  expect(result.items.map((f) => f.foodId)).toEqual(ids.map(String));
  expect(result.items.every((f) => f.risk === 'unable')).toBe(true);
});
it('represents authoritative partial/all unavailable without replacement foods', () => {
  expect(adaptSelectedFoods({items:[item(444)],unavailableFoodIds:[743]}, [743,444]).unavailableFoodIds).toEqual([743]);
  expect(adaptSelectedFoods({items:[],unavailableFoodIds:[743,444]}, [743,444]).items).toEqual([]);
});
it.each([
  null, {}, {items:[],unavailableFoodIds:[]},
  {items:[item(444),item(743)],unavailableFoodIds:[]},
  {items:[item(743)],unavailableFoodIds:[743]},
  {items:[item(743),item(999)],unavailableFoodIds:[]},
  {items:[item(743,'NOT_A_RISK'),item(444)],unavailableFoodIds:[]},
  {items:[{...item(743),review:null},item(444)],unavailableFoodIds:[]},
])('rejects malformed partition/order/risk without turning it SAFE: %j', (raw) => {
  expect(() => adaptSelectedFoods(raw,[743,444])).toThrow();
});
