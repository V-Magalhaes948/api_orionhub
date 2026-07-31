import Sequelize, { Model } from 'sequelize';

export default class FlowStep extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        flow_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        order: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        content: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        completion_criteria: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        closes_conversation: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        hands_off_to_human: {
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
    this.belongsTo(models.Flow, { foreignKey: 'flow_id', as: 'flow' });
  }
}
