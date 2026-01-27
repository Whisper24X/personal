# 项目说明
智能硬件-示例项目
> 该项目基于 `gitlab.yc345.tv/backend/yc_kratos_gen_layout` 项目生成

## 项目介绍

- 该项目在技术栈脚手架的基础上集成.
- 智能硬件新服务和重构服务提供示例和基准.
- 集成一些智能硬件组内业务常用功能.

## 效率工具

* 数据库代码生成:`make gorm`
* 接口文档生成并上传到yapi和apifox:`make api` && `make apidoc`
* 错误码导出markdown:`make errcode`
* 数据库文件导出sql文件:`make sqldump`
* 数据库表结构生成pb文件:`make sqltopb`
* pb文件生成service,biz,data代码:`make protocode`
* swagger文件生成压测文件jmx:`make apijmeter`
* pb文件格式化:`make buf`


## 常规开发步骤

1. 在测试环境创建或更新数据库相关内容:库,表,索引,然后执行`make gorm`生成数据库相关内容.
2. 使用`make sqltopb`可生成pb文件.
3. 在项目中编写`proto`文件,务必编写注释,不能遗漏,完成后执行`make buf`格式化pb,然后执行`make api`生成相关代码.
4. 在项目中执行`make swagger`生成接口swagger文件.然后执行`make apidoc`将生成的文档文件上传到yapi或者apifox.
5. 编写业务代码.执行`make wire`生成依赖注入代码.
6. 执行`kratos run`检测是否能启动. 
7. 执行`make lint`检测代码的异常情况,解决完所有的异常后才能提交代码. 
8. 提交代码
