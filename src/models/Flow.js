import Sequelize, { Model } from 'sequelize';

export default class Flow extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        test_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        include_catalog: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
      },
      { sequelize }
    );

    return this;
  }

  static associate(models) {
    this.hasMany(models.FlowStep, { foreignKey: 'flow_id', as: 'steps' });
    this.hasMany(models.FlowSession, { foreignKey: 'flow_id', as: 'sessions' });
  }
}
