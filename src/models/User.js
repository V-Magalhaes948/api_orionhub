import Sequelize, { Model } from 'sequelize';
import bcrypt from 'bcryptjs';

export default class User extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        plan_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        addon_id: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        is_admin: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        name: {
          type: Sequelize.STRING,
          defaultValue: '',
          validate: {
            len: {
              args: [3, 255],
              msg: 'Campo nome deve ter entre 3 e 255 caracteres.',
            },
          },
        },
        email: {
          type: Sequelize.STRING,
          defaultValue: '',
          unique: {
            msg: 'E-mail já existe.',
          },
          validate: {
            isEmail: {
              msg: 'E-mail inválido.',
            },
          },
        },
        refresh_token: {
          type: Sequelize.STRING(512),
          allowNull: true,
        },
        messages_this_month: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        messages_reset_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        last_login_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        suspended_reason: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        plan_status: {
          type: Sequelize.ENUM(
            'active',
            'expired',
            'pending',
            'trialing',
            'pending_verification'
          ),
          defaultValue: 'pending',
        },
        plan_expires_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        account_status: {
          type: Sequelize.ENUM('active', 'suspended', 'deleted'),
          allowNull: false,
          defaultValue: 'active',
        },
        reset_token_hash: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        reset_token_expires_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        addon_status: {
          type: Sequelize.ENUM('active', 'expired'),
          allowNull: true,
        },
        addon_expires_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        product_selection_pending: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        instance_selection_pending: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        failed_login_attempts: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
        },
        locked_until: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        email_verified: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false,
        },
        verification_code: {
          type: Sequelize.STRING(6),
          allowNull: true,
        },
        verification_code_expires_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        verification_attempts: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
          allowNull: false,
        },
        password_hash: {
          type: Sequelize.STRING,
          defaultValue: '',
        },
        password: {
          type: Sequelize.VIRTUAL,
          defaultValue: '',
          validate: {
            passwordLength(value) {
              if (value && (value.length < 6 || value.length > 50)) {
                throw new Error('A senha precisa ter entre 6 a 50 caracteres.');
              }
            },
          },
        },
      },
      {
        sequelize,
        tableName: 'users',
      }
    );

    this.addHook('beforeSave', async (user) => {
      if (user.password) {
        user.password_hash = await bcrypt.hash(user.password, 12);
      }
    });

    return this;
  }

  checkPassword(password) {
    return bcrypt.compare(password, this.password_hash);
  }

  static associate(models) {
    this.hasMany(models.Bot, { foreignKey: 'user_id', as: 'bots' });
    this.hasMany(models.StoreFront, { foreignKey: 'user_id' });
    this.hasMany(models.Product, { foreignKey: 'user_id', as: 'products' });
    this.hasMany(models.AdminAuditLog, {
      foreignKey: 'admin_id',
      as: 'actionsPerformed',
    });
    this.hasMany(models.AdminAuditLog, {
      foreignKey: 'target_user_id',
      as: 'actionsReceived',
    });
    this.belongsTo(models.Plan, { foreignKey: 'plan_id', as: 'plan' });
    this.belongsTo(models.AddonPackage, {
      foreignKey: 'addon_id',
      as: 'addon',
    });
  }
}
