import Sequelize, { Model } from 'sequelize';

export default class FlowSession extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        conversation_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        flow_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        current_step_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        data: {
          type: Sequelize.JSON,
          defaultValue: {},
        },
        completed: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
      },
      { sequelize }
    );

    return this;
  }

  static associate(models) {
    this.belongsTo(models.Conversation, {
      foreignKey: 'conversation_id',
      as: 'conversation',
    });
    this.belongsTo(models.Flow, { foreignKey: 'flow_id', as: 'flow' });
    this.belongsTo(models.FlowStep, {
      foreignKey: 'current_step_id',
      as: 'currentStep',
    });
  }
}
