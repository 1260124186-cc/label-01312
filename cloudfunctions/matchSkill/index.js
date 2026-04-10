// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 技能匹配算法云函数
 * 根据用户的需求，匹配合适的技能提供者
 * 匹配因素：技能类型、校区、时间偏好
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  const {
    category,      // 技能分类
    campus,        // 校区偏好
    availableTime, // 可用时间段
    type,          // 匹配类型：findSkill(找技能提供者) / findNeed(找需求者)
    page = 1,      // 分页
    pageSize = 10
  } = event;

  try {
    // 构建查询条件
    let query = {
      _openid: _.neq(openid), // 排除自己
      status: 'active'        // 只匹配活跃的技能/需求
    };

    // 根据匹配类型设置查询类型
    if (type === 'findSkill') {
      query.type = 'skill'; // 找技能提供者
    } else if (type === 'findNeed') {
      query.type = 'need';  // 找需求者
    }

    // 技能分类筛选
    if (category) {
      query.category = category;
    }

    // 校区筛选
    if (campus) {
      query.campus = campus;
    }

    // 查询匹配的技能/需求
    const skillsResult = await db.collection('skills')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    let matchedSkills = skillsResult.data;

    // 计算匹配分数
    matchedSkills = matchedSkills.map(skill => {
      let matchScore = 0;

      // 校区匹配 +30分
      if (campus && skill.campus === campus) {
        matchScore += 30;
      }

      // 分类匹配 +40分
      if (category && skill.category === category) {
        matchScore += 40;
      }

      // 时间匹配 +30分（检查是否有重叠的可用时间）
      if (availableTime && availableTime.length > 0 && skill.availableTime) {
        const timeOverlap = availableTime.some(time => 
          skill.availableTime.includes(time)
        );
        if (timeOverlap) {
          matchScore += 30;
        }
      }

      // 信誉分加成（信誉分越高，排名越靠前）
      if (skill.publisherInfo && skill.publisherInfo.creditScore) {
        matchScore += Math.floor(skill.publisherInfo.creditScore / 10);
      }

      return {
        ...skill,
        matchScore
      };
    });

    // 按匹配分数排序
    matchedSkills.sort((a, b) => b.matchScore - a.matchScore);

    // 获取总数
    const countResult = await db.collection('skills')
      .where(query)
      .count();

    return {
      code: 0,
      message: '匹配成功',
      data: {
        list: matchedSkills,
        total: countResult.total,
        page: page,
        pageSize: pageSize,
        hasMore: countResult.total > page * pageSize
      }
    };
  } catch (err) {
    console.error('技能匹配失败', err);
    return {
      code: -1,
      message: '匹配失败',
      error: err
    };
  }
};
