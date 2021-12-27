<template>
  <div>
    <el-form :model="ruleForm" :rules="rules" ref="ruleForm">
      <el-form-item label="活动区域" prop="region">
        <el-select v-model="ruleForm.region" placeholder="请选择活动区域">
          <el-option label="newHome" value="newHome"></el-option>
        </el-select>
      </el-form-item>
    </el-form>
    <el-card>
       <div slot="header">
        <span>newHome</span>
      </div>

      <el-radio-group v-model="configValue">
        <el-row>
          <el-radio :label="0">原样式：置顶icon，来源和发布时间在标题下一行</el-radio>
        </el-row>
        <el-row>
          <el-radio :label="1">新样式：置顶icon前移至标题前方，去除来源和发布时间</el-radio>
        </el-row>
      </el-radio-group>

      <el-row>
        <el-button type="primary" @click="onSave">保存</el-button >
        <el-button type="info" @click="onCancel">取 消 </el-button>
      </el-row>
    </el-card>
  </div>
</template>

<script>
import { getStickStyle, modifyStickStyle } from '@/api/card/stick';
export default {
  name: "",
  props: {
  },
  data() {
    return {
      ruleForm: {
        region: '',
      },
      configValue: '',
      rules: {
        region: [
          { required: true, message: '请选择置顶样式', trigger: 'change' }
        ],
      }
    };
  },
  mounted() {
    getStickStyle().then(res => {
      console.log(res)
    })
  },
  methods: {
    onSave() {
      modifyStickStyle({ configValue: this.configValue }).then(res => {
        this.$message.success('保存成功!');
      }).catch(e => {
        this.$error(e);
      });
    },
    onCancel() {

    }
  }
}

</script>
<style lang='scss' scoped>
</style>
