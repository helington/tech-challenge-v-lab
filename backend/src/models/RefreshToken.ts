import { 
  DataTypes, 
  Model, 
  Optional, 
  Association,
  HasManyGetAssociationsMixin,
  BelongsToGetAssociationMixin,
  HasManyCountAssociationsMixin
} from 'sequelize';
import { sequelize } from '../config/database';

interface RefreshTokenAttributes {
  id: number;
  token: string;
  ownerId: number;
  createdAt?: Date;
  expiresAt?: Date;
}

interface RefreshTokenCreationAttributes extends Optional<RefreshTokenAttributes, 'id' | 'token' | 'createdAt' | 'expiresAt'> {}

class RefreshToken extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes> implements RefreshTokenAttributes {
  public id!: number;
  public token!: string;
  public ownerId!: number;
  public readonly createdAt!: Date;
  public readonly expiresAt!: Date;

  // Associations
  public getOwner!: BelongsToGetAssociationMixin<any>;

  public static associations: {
    author: Association<RefreshToken, any>;
  };
}

RefreshToken.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    token: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
  },
  {
    sequelize,
    tableName: 'refreshTokens',
    indexes: [
      {
        fields: ['ownerId'],
      },
    ],
  }
);

export default RefreshToken;