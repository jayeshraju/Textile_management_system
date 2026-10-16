const { ProductionOrder, Machine } = require('../models');
const { calculateOrderMetrics, escapeRegex } = require('../utils/derivedMetrics');
const { PAGINATION, ALLOWED_ORDER_SORT_FIELDS } = require('../config/thresholds');

const ORDER_NUMBER_REGEX = /^PO-[A-Z0-9-]+$/i;

const getOrders = async (req, res, next) => {
  try {
    const {
      status,
      delayStatus,
      search,
      page = 1,
      limit = PAGINATION.DEFAULT_LIMIT,
      sort = '-createdAt',
    } = req.query;

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      PAGINATION.MAX_LIMIT,
      Math.max(1, parseInt(limit, 10) || PAGINATION.DEFAULT_LIMIT)
    );

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
    if (sortField && !ALLOWED_ORDER_SORT_FIELDS.includes(sortField)) {
      return res.status(400).json({
        error: {
          message: `Invalid sort field '${sortField}'. Allowed fields: ${ALLOWED_ORDER_SORT_FIELDS.join(', ')}`,
          code: 'INVALID_SORT_FIELD',
        },
      });
    }

    const queryFilter = {};

    if (status) {
      queryFilter.status = status;
    }

    if (search && search.trim() !== '') {
      const sanitized = escapeRegex(search.trim());
      queryFilter.$or = [
        { orderNumber: { $regex: sanitized, $options: 'i' } },
        { customer: { $regex: sanitized, $options: 'i' } },
        { fabricType: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const allOrders = await ProductionOrder.find(queryFilter)
      .populate('assignedMachine')
      .sort(sort)
      .lean();

    const now = new Date();

    let enrichedOrders = allOrders.map((order) => {
      const metrics = calculateOrderMetrics(order, now);
      return {
        ...order,
        ...metrics,
        buyer: order.customer,
      };
    });

    if (delayStatus) {
      enrichedOrders = enrichedOrders.filter((o) => o.delayStatus === delayStatus);
    }

    const total = enrichedOrders.length;
    const totalPages = Math.ceil(total / parsedLimit) || 1;
    const startIndex = (parsedPage - 1) * parsedLimit;
    const paginatedOrders = enrichedOrders.slice(startIndex, startIndex + parsedLimit);

    return res.status(200).json({
      orders: paginatedOrders,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getOrderByNumber = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber || !ORDER_NUMBER_REGEX.test(orderNumber.trim())) {
      return res.status(400).json({
        error: {
          message: `Invalid order number format '${orderNumber}'. Expected format e.g. 'PO-2026-0001'`,
          code: 'INVALID_ORDER_NUMBER',
        },
      });
    }

    const order = await ProductionOrder.findOne({
      orderNumber: orderNumber.trim().toUpperCase(),
    })
      .populate('assignedMachine')
      .lean();

    if (!order) {
      return res.status(404).json({
        error: {
          message: `Production order '${orderNumber}' not found`,
          code: 'ORDER_NOT_FOUND',
        },
      });
    }

    const metrics = calculateOrderMetrics(order, new Date());

    return res.status(200).json({
      order: {
        ...order,
        ...metrics,
        buyer: order.customer,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber || !ORDER_NUMBER_REGEX.test(orderNumber.trim())) {
      return res.status(400).json({
        error: {
          message: `Invalid order number format '${orderNumber}'. Expected format e.g. 'PO-2026-0001'`,
          code: 'INVALID_ORDER_NUMBER',
        },
      });
    }

    const allowedUpdateFields = ['producedQuantity', 'status'];
    const payloadKeys = Object.keys(req.body);

    if (payloadKeys.length === 0) {
      return res.status(400).json({
        error: {
          message: 'PATCH request body cannot be empty',
          code: 'EMPTY_PAYLOAD',
        },
      });
    }

    const unknownFields = payloadKeys.filter((k) => !allowedUpdateFields.includes(k));
    if (unknownFields.length > 0) {
      return res.status(422).json({
        error: {
          message: `Unknown or non-updatable field(s): ${unknownFields.join(', ')}. Only 'producedQuantity' and 'status' can be updated.`,
          code: 'DISALLOWED_FIELD',
        },
      });
    }

    const order = await ProductionOrder.findOne({
      orderNumber: orderNumber.trim().toUpperCase(),
    });

    if (!order) {
      return res.status(404).json({
        error: {
          message: `Production order '${orderNumber}' not found`,
          code: 'ORDER_NOT_FOUND',
        },
      });
    }

    const reqQty = Number(order.requiredQuantity ?? order.quantity);

    if (req.body.producedQuantity !== undefined) {
      const prodQty = Number(req.body.producedQuantity);

      if (isNaN(prodQty)) {
        return res.status(422).json({
          error: {
            message: 'Field `producedQuantity` must be a valid number',
            code: 'INVALID_TYPE',
          },
        });
      }

      if (prodQty < 0) {
        return res.status(422).json({
          error: {
            message: `producedQuantity (${prodQty}) cannot be negative`,
            code: 'NEGATIVE_QUANTITY',
          },
        });
      }

      if (prodQty > reqQty) {
        return res.status(422).json({
          error: {
            message: `producedQuantity (${prodQty}) cannot exceed requiredQuantity (${reqQty})`,
            code: 'EXCEEDS_REQUIRED_QUANTITY',
          },
        });
      }

      order.producedQuantity = prodQty;

      if (prodQty === reqQty) {
        order.status = 'completed';
      }
    }

    if (req.body.status !== undefined) {
      const validStatuses = ['queued', 'in_progress', 'completed', 'on_hold', 'draft', 'planned', 'cancelled'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(422).json({
          error: {
            message: `Invalid status '${req.body.status}'. Valid values: ${validStatuses.join(', ')}`,
            code: 'INVALID_STATUS',
          },
        });
      }
      order.status = req.body.status;
    }

    if (req.user) {
      order.updatedBy = {
        userId: req.user._id,
        name: req.user.name,
      };
    }

    await order.save();
    await order.populate('assignedMachine');

    const metrics = calculateOrderMetrics(order.toObject(), new Date());

    return res.status(200).json({
      order: {
        ...order.toObject(),
        ...metrics,
        buyer: order.customer,
      },
    });
  } catch (error) {
    next(error);
  }
};

const createOrder = async (req, res, next) => {
  try {
    const {
      customer,
      buyer,
      fabricType,
      requiredQuantity,
      quantity,
      unit = 'meters',
      dueDate,
      startDate = new Date(),
      priority = 'medium',
      machineCode,
      assignedMachine,
      productionRatePerDay,
      notes = '',
    } = req.body;

    const targetCustomer = customer || buyer;
    if (!targetCustomer || targetCustomer.trim() === '') {
      return res.status(422).json({
        error: {
          message: 'Customer / Buyer name is required',
          code: 'MISSING_CUSTOMER',
        },
      });
    }

    if (!fabricType || fabricType.trim() === '') {
      return res.status(422).json({
        error: {
          message: 'Fabric type specification is required',
          code: 'MISSING_FABRIC_TYPE',
        },
      });
    }

    const reqQty = Number(requiredQuantity ?? quantity);
    if (isNaN(reqQty) || reqQty <= 0) {
      return res.status(422).json({
        error: {
          message: 'Required quantity must be a positive number',
          code: 'INVALID_QUANTITY',
        },
      });
    }

    if (!dueDate) {
      return res.status(422).json({
        error: {
          message: 'Due date is required',
          code: 'MISSING_DUE_DATE',
        },
      });
    }

    let resolvedMachineId = null;
    if (assignedMachine) {
      const machine = await Machine.findById(assignedMachine);
      if (!machine) {
        return res.status(422).json({
          error: {
            message: `Machine with ID '${assignedMachine}' does not exist`,
            code: 'MACHINE_NOT_FOUND',
          },
        });
      }
      resolvedMachineId = machine._id;
    } else if (machineCode) {
      const machine = await Machine.findOne({ code: machineCode.trim().toUpperCase() });
      if (!machine) {
        return res.status(422).json({
          error: {
            message: `Machine with code '${machineCode}' does not exist`,
            code: 'MACHINE_NOT_FOUND',
          },
        });
      }
      resolvedMachineId = machine._id;
    }

    const currentYear = new Date().getFullYear();
    const count = (await ProductionOrder.countDocuments()) + 1;
    const paddedCount = String(count).padStart(4, '0');
    let candidateOrderNumber = req.body.orderNumber || `PO-${currentYear}-${paddedCount}`;

    let exists = await ProductionOrder.exists({ orderNumber: candidateOrderNumber });
    let counter = count;
    while (exists) {
      counter++;
      candidateOrderNumber = `PO-${currentYear}-${String(counter).padStart(4, '0')}`;
      exists = await ProductionOrder.exists({ orderNumber: candidateOrderNumber });
    }

    const newOrder = new ProductionOrder({
      orderNumber: candidateOrderNumber,
      customer: targetCustomer.trim(),
      fabricType: fabricType.trim(),
      requiredQuantity: reqQty,
      quantity: reqQty,
      producedQuantity: 0,
      unit,
      startDate: new Date(startDate),
      dueDate: new Date(dueDate),
      priority,
      status: 'in_progress',
      currentStage: 'weaving',
      assignedMachine: resolvedMachineId,
      productionRatePerDay: productionRatePerDay ? Number(productionRatePerDay) : null,
      notes: notes.trim(),
    });

    await newOrder.save();
    if (resolvedMachineId) {
      await Machine.findByIdAndUpdate(resolvedMachineId, {
        currentAssignedOrder: newOrder._id,
        status: 'running',
      });
    }

    await newOrder.populate('assignedMachine');
    const metrics = calculateOrderMetrics(newOrder.toObject(), new Date());

    return res.status(201).json({
      order: {
        ...newOrder.toObject(),
        ...metrics,
        buyer: newOrder.customer,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteOrder = async (req, res, next) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber || !ORDER_NUMBER_REGEX.test(orderNumber.trim())) {
      return res.status(400).json({
        error: {
          message: `Invalid order number format '${orderNumber}'. Expected format e.g. 'PO-2026-0001'`,
          code: 'INVALID_ORDER_NUMBER',
        },
      });
    }

    const order = await ProductionOrder.findOne({
      orderNumber: orderNumber.trim().toUpperCase(),
    });

    if (!order) {
      return res.status(404).json({
        error: {
          message: `Production order '${orderNumber}' not found`,
          code: 'ORDER_NOT_FOUND',
        },
      });
    }

    if (order.assignedMachine) {
      await Machine.findByIdAndUpdate(order.assignedMachine, {
        currentAssignedOrder: null,
      });
    }

    await ProductionOrder.deleteOne({ _id: order._id });

    return res.status(200).json({
      success: true,
      message: `Production order ${order.orderNumber} successfully deleted.`,
      deletedOrderNumber: order.orderNumber,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrders,
  getOrderByNumber,
  updateOrder,
  createOrder,
  deleteOrder,
};
