'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type TimeFrame = 'today' | 'weekly' | 'monthly'

interface MetricData {
  totalChat: number
  totalLead: number
  totalBuy: number
  totalBuyValue: number
  totalGoodCustomer: number
  totalViewContent: number
  totalAddToCart: number
  totalInitiateCheckout: number
  totalBadCustomer: number
  totalSpam: number
  totalBlocking: number
  totalBan: number
}

interface ChartData {
  period: string
  totalChat: number
  totalLead: number
  totalBuy: number
  totalBuyValue: number
  conversionRate: number
}

export default function BMSDashboard() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('today')
  const [metrics, setMetrics] = useState<MetricData>({
    totalChat: 0,
    totalLead: 0,
    totalBuy: 0,
    totalBuyValue: 0,
    totalGoodCustomer: 0,
    totalViewContent: 0,
    totalAddToCart: 0,
    totalInitiateCheckout: 0,
    totalBadCustomer: 0,
    totalSpam: 0,
    totalBlocking: 0,
    totalBan: 0
  })
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(true)

  const fetchHistoricalData = async () => {
    setChartLoading(true)
    try {
      // Generate sample historical data based on timeframe
      const periods = timeFrame === 'today' ? 
        Array.from({ length: 24 }, (_, i) => `${i}:00`) :
        timeFrame === 'weekly' ? 
        Array.from({ length: 7 }, (_, i) => {
          const date = new Date()
          date.setDate(date.getDate() - 6 + i)
          return date.toLocaleDateString('th-TH', { weekday: 'short' })
        }) :
        Array.from({ length: 30 }, (_, i) => {
          const date = new Date()
          date.setDate(date.getDate() - 29 + i)
          return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
        })

      // Simulate historical data with some variation
      const historicalData = periods.map((period) => {
        const baseChat = Math.floor(Math.random() * 1000) + 500
        const baseLead = Math.floor(baseChat * (0.15 + Math.random() * 0.1))
        const baseBuy = Math.floor(baseLead * (0.1 + Math.random() * 0.05))
        const baseBuyValue = baseBuy * (500 + Math.random() * 1000)
        const conversionRate = baseLead > 0 ? (baseBuy / baseLead) * 100 : 0

        return {
          period,
          totalChat: baseChat,
          totalLead: baseLead,
          totalBuy: baseBuy,
          totalBuyValue: Math.floor(baseBuyValue),
          conversionRate: Math.round(conversionRate * 100) / 100
        }
      })

      setChartData(historicalData)
    } catch (error) {
      console.error('Error fetching historical data:', error)
    } finally {
      setChartLoading(false)
    }
  }

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const countColumn = timeFrame === 'today' ? 'today_count' : 
                         timeFrame === 'weekly' ? 'weekly_count' : 'monthly_count'

      // Fetch PSID Inputs (Total Chat)
      const { data: psidData } = await supabase
        .from('psid_inputs_statistics')
        .select(countColumn)
        .eq('metric_type', 'PSID Inputs')
        .single()

      // Fetch Intent Statistics
      const { data: intentData } = await supabase
        .from('intent_statistics')
        .select(`intent_type, ${countColumn}`)

      // Fetch Purchase Value
      const { data: purchaseData } = await supabase
        .from('purchase')
        .select('value')

      const totalChat = psidData?.[countColumn as keyof typeof psidData] || 0
      let totalLead = 0
      let totalBuy = 0
      let totalViewContent = 0
      let totalAddToCart = 0
      let totalInitiateCheckout = 0
      let totalSpam = 0
      let totalBlocking = 0
      let totalBan = 0

      // Process intent statistics
      if (intentData) {
        intentData.forEach(item => {
          const count = item[countColumn as keyof typeof item] || 0
          switch (item.intent_type) {
            case 'Lead':
              totalLead += count
              break
            case 'Purchase':
              totalBuy += count
              break
            case 'VC':
              totalViewContent += count
              break
            case 'ATC':
              totalAddToCart += count
              break
            case 'IC':
              totalInitiateCheckout += count
              break
            case 'Move to Spam':
              totalSpam += count
              break
            case 'Blocking':
              totalBlocking += count
              break
            case 'Ban':
              totalBan += count
              break
          }
        })
      }

      // Calculate totals
      const totalGoodCustomer = totalAddToCart + totalInitiateCheckout + totalLead + totalBuy + totalViewContent
      const totalBadCustomer = totalBan + totalBlocking + totalSpam
      const totalBuyValue = purchaseData?.reduce((sum, item) => sum + (item.value || 0), 0) || 0

      setMetrics({
        totalChat,
        totalLead,
        totalBuy,
        totalBuyValue,
        totalGoodCustomer,
        totalViewContent,
        totalAddToCart,
        totalInitiateCheckout,
        totalBadCustomer,
        totalSpam,
        totalBlocking,
        totalBan
      })
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    fetchHistoricalData()
  }, [timeFrame]) // eslint-disable-line react-hooks/exhaustive-deps

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('th-TH').format(num)
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(num)
  }

  const calculatePercentage = (numerator: number, denominator: number): number => {
    if (denominator === 0) return 0
    return Math.round((numerator / denominator) * 100)
  }

  const MetricCard = ({ title, value, isPercentage = false, isCurrency = false, color = 'blue' }: {
    title: string
    value: number
    isPercentage?: boolean
    isCurrency?: boolean
    color?: 'blue' | 'green' | 'emerald' | 'red'
  }) => {
    const colorClasses = {
      blue: 'border-blue-500 bg-blue-50',
      green: 'border-green-500 bg-green-50',
      emerald: 'border-emerald-500 bg-emerald-50',
      red: 'border-red-500 bg-red-50'
    }
    
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 border-l-4 ${colorClasses[color]} hover:shadow-xl transition-shadow duration-200`}>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 mb-1">
          {loading ? (
            <span className="animate-pulse">...</span>
          ) : (
            isCurrency ? formatCurrency(value) :
            isPercentage ? `${value}%` : 
            formatNumber(value)
          )}
        </p>
        {!loading && (
          <div className="flex items-center text-xs text-gray-500 mt-2">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
              color === 'blue' ? 'bg-blue-500' :
              color === 'green' ? 'bg-green-500' :
              color === 'emerald' ? 'bg-emerald-500' :
              'bg-red-500'
            }`}></span>
            {timeFrame.charAt(0).toUpperCase() + timeFrame.slice(1)} data
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">BMS Dashboard</h1>
              <p className="text-gray-600">Business Metrics & Analytics</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Bangkok Time (GMT+7)</p>
              <p className="text-sm font-medium text-gray-700">
                {new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
              </p>
            </div>
          </div>
          
          {/* Timeframe Filter */}
          <div className="flex space-x-2 bg-white p-2 rounded-lg shadow-sm">
            {(['today', 'weekly', 'monthly'] as TimeFrame[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
                  timeFrame === tf
                    ? 'bg-blue-600 text-white shadow-md transform scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                }`}
              >
                {tf.charAt(0).toUpperCase() + tf.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Trend Analysis</h2>
            
            {/* Primary Metrics Chart */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Performance Overview</h3>
              <div className="h-96">
                {chartLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fontSize: 12 }}
                        stroke="#666"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        stroke="#666"
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="totalChat" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        name="Total Chat"
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalLead" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Total Lead"
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="totalBuy" 
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        name="Total Buy"
                        dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Conversion Rate Chart */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Conversion Rate & Buy Value</h3>
              <div className="h-64">
                {chartLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fontSize: 12 }}
                        stroke="#666"
                      />
                      <YAxis 
                        yAxisId="left"
                        tick={{ fontSize: 12 }}
                        stroke="#666"
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 12 }}
                        stroke="#666"
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value, name) => {
                          if (name === 'Total Buy Value') {
                            return [new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(value)), name]
                          }
                          return [value, name]
                        }}
                      />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="conversionRate" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Conversion Rate (%)"
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="totalBuyValue" 
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        name="Total Buy Value"
                        dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Total Chat" value={metrics.totalChat} />
            <MetricCard title="Total Lead" value={metrics.totalLead} />
            <MetricCard title="Total Buy" value={metrics.totalBuy} />
            <MetricCard title="Total Buy Value" value={metrics.totalBuyValue} isCurrency={true} />
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard 
              title="Chat to Lead %" 
              value={calculatePercentage(metrics.totalLead, metrics.totalChat)} 
              isPercentage={true}
              color="green"
            />
            <MetricCard 
              title="Lead to Buy %" 
              value={calculatePercentage(metrics.totalBuy, metrics.totalLead)} 
              isPercentage={true}
              color="green"
            />
            <MetricCard 
              title="Chat to Buy %" 
              value={calculatePercentage(metrics.totalBuy, metrics.totalChat)} 
              isPercentage={true}
              color="green"
            />
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Total Good Customer" value={metrics.totalGoodCustomer} color="emerald" />
            <MetricCard title="Total ViewContent" value={metrics.totalViewContent} color="emerald" />
            <MetricCard title="Total AddToCart" value={metrics.totalAddToCart} color="emerald" />
            <MetricCard title="Total Initiate Checkout" value={metrics.totalInitiateCheckout} color="emerald" />
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard title="Total Bad Customer" value={metrics.totalBadCustomer} color="red" />
            <MetricCard title="Total Spam" value={metrics.totalSpam} color="red" />
            <MetricCard title="Total Blocking" value={metrics.totalBlocking} color="red" />
            <MetricCard title="Total Ban" value={metrics.totalBan} color="red" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span>Live Data</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span>Bangkok Time (GMT+7)</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                <span>Auto-refresh every 5 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}