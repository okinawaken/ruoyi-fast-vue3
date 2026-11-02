<template>
  <div v-loading="loading" class="tab-body">
    <el-table :data="orders" empty-text="暂无订单">
      <el-table-column prop="packageName" label="套餐" min-width="180" show-overflow-tooltip />
      <el-table-column label="金额" width="110" align="right">
        <template #default="{ row }">
          <span class="sr-mono">¥{{ formatMoney(row.payRealMoney ?? row.payPrice) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="payStateStr" label="状态" width="100" align="center">
        <template #default="{ row }">
          <span class="sr-chip" :class="Number(row.payState) === 1 ? 'sr-chip-green' : 'sr-chip-amber'">
            <span class="sr-dot"></span>{{ row.payStateStr || '—' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="payTypeStr" label="支付方式" width="110" align="center" />
      <el-table-column prop="orderNumber" label="订单号" min-width="180" show-overflow-tooltip />
      <el-table-column prop="buyTimeStr" label="下单时间" width="165" />
    </el-table>
  </div>
</template>

<script setup>
import { formatMoney } from '@/utils/study/value'

defineProps({
  orders: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})
</script>
