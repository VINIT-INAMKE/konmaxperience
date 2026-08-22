import 'reflect-metadata';
import { IngredientCategoriesController } from './ingredient-categories.controller';
import { REQUIRED_PERMISSION_KEY } from '../common/decorators/permissions.decorator';
import { Permission } from '../types/permissions';

describe('IngredientCategoriesController permissions', () => {
  it('requires MANAGE_INVENTORY to create', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        IngredientCategoriesController.prototype.create,
      ),
    ).toBe(Permission.MANAGE_INVENTORY);
  });

  it('requires MANAGE_INVENTORY to delete', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        IngredientCategoriesController.prototype.remove,
      ),
    ).toBe(Permission.MANAGE_INVENTORY);
  });

  it('leaves the list endpoint open to all staff', () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION_KEY,
        IngredientCategoriesController.prototype.findAll,
      ),
    ).toBeUndefined();
  });
});
