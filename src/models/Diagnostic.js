import Sequelize, { Model } from 'sequelize';

export default class Diagnostic extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        company: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        segment: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        hasManualService: {
          type: Sequelize.ENUM('Sim', 'Não'),
          allowNull: false,
        },
        teamSize: {
          type: Sequelize.ENUM(
            'Apenas eu',
            '2 a 5 vendedores',
            '6 a 15 vendedores',
            'Mais de 15'
          ),
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'diagnostics_submissions',
        underscored: false,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      }
    );

    return this;
  }
}
